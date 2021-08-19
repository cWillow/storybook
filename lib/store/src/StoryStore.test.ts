import { prepareStory } from './prepareStory';
import { processCSFFile } from './processCSFFile';
import { StoryStore } from './StoryStore';
import { StoriesList, GlobalMeta } from './types';

// Spy on prepareStory/processCSFFile
jest.mock('./prepareStory', () => ({
  prepareStory: jest.fn(jest.requireActual('./prepareStory').prepareStory),
}));
jest.mock('./processCSFFile', () => ({
  processCSFFile: jest.fn(jest.requireActual('./processCSFFile').processCSFFile),
}));

const componentOneExports = {
  default: { title: 'Component One' },
  a: { args: { foo: 'a' } },
  b: { args: { foo: 'b' } },
};
const componentTwoExports = {
  default: { title: 'Component Two' },
  c: { args: { foo: 'c' } },
};
const importFn = jest.fn(async (path) => {
  return path === './src/ComponentOne.stories.js' ? componentOneExports : componentTwoExports;
});

const globalMeta: GlobalMeta<any> = { globals: { a: 'b' }, globalTypes: {}, render: jest.fn() };

const storiesList: StoriesList = {
  v: 3,
  stories: {
    'component-one--a': {
      title: 'Component One',
      name: 'A',
      importPath: './src/ComponentOne.stories.js',
    },
    'component-one--b': {
      title: 'Component One',
      name: 'B',
      importPath: './src/ComponentOne.stories.js',
    },
    'component-two--c': {
      title: 'Component Two',
      name: 'C',
      importPath: './src/ComponentTwo.stories.js',
    },
  },
};
const fetchStoriesList = async () => storiesList;

describe('StoryStore', () => {
  describe('loadStory', () => {
    it('pulls the story via the importFn', async () => {
      const store = new StoryStore({ importFn, globalMeta, fetchStoriesList });
      await store.initialize();

      importFn.mockClear();
      expect(await store.loadStory({ storyId: 'component-one--a' })).toMatchObject({
        id: 'component-one--a',
        name: 'A',
        title: 'Component One',
        initialArgs: { foo: 'a' },
      });
      expect(importFn).toHaveBeenCalledWith('./src/ComponentOne.stories.js');
    });

    it('uses a cache', async () => {
      const store = new StoryStore({ importFn, globalMeta, fetchStoriesList });
      await store.initialize();

      const story = await store.loadStory({ storyId: 'component-one--a' });
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(1);

      // We are intentionally checking exact equality here, we need the object to be identical
      expect(await store.loadStory({ storyId: 'component-one--a' })).toBe(story);
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(1);

      await store.loadStory({ storyId: 'component-one--b' });
      expect(processCSFFile).toHaveBeenCalledTimes(1);
      expect(prepareStory).toHaveBeenCalledTimes(2);

      await store.loadStory({ storyId: 'component-two--c' });
      expect(processCSFFile).toHaveBeenCalledTimes(2);
      expect(prepareStory).toHaveBeenCalledTimes(3);
    });
  });

  describe('componentStoriesFromCSFFile', () => {
    it('returns all the stories in the file', async () => {
      const store = new StoryStore({ importFn, globalMeta, fetchStoriesList });
      await store.initialize();

      const csfFile = await store.loadCSFFileByStoryId('component-one--a');
      const stories = store.componentStoriesFromCSFFile({ csfFile });

      expect(stories).toHaveLength(2);
      expect(stories.map((s) => s.id)).toEqual(['component-one--a', 'component-one--b']);
    });
  });

  describe('getStoryContext', () => {
    it('returns the args and globals correctly', async () => {
      const store = new StoryStore({ importFn, globalMeta, fetchStoriesList });
      await store.initialize();

      const story = await store.loadStory({ storyId: 'component-one--a' });

      expect(store.getStoryContext(story)).toMatchObject({
        args: { foo: 'a' },
        globals: { a: 'b' },
      });
    });

    it('returns the args and globals correctly when they change', async () => {
      const store = new StoryStore({ importFn, globalMeta, fetchStoriesList });
      await store.initialize();

      const story = await store.loadStory({ storyId: 'component-one--a' });

      store.args.update(story.id, { foo: 'bar' });
      store.globals.update({ a: 'c' });

      expect(store.getStoryContext(story)).toMatchObject({
        args: { foo: 'bar' },
        globals: { a: 'c' },
      });
    });

    it('returns the same hooks each time', async () => {
      const store = new StoryStore({ importFn, globalMeta, fetchStoriesList });
      await store.initialize();

      const story = await store.loadStory({ storyId: 'component-one--a' });

      const { hooks } = store.getStoryContext(story);
      expect(store.getStoryContext(story).hooks).toBe(hooks);
    });
  });

  describe('cleanupStory', () => {
    it('cleans the hooks from the context', async () => {
      const store = new StoryStore({ importFn, globalMeta, fetchStoriesList });
      await store.initialize();

      const story = await store.loadStory({ storyId: 'component-one--a' });

      const { hooks } = store.getStoryContext(story);
      hooks.clean = jest.fn();
      store.cleanupStory(story);
      expect(hooks.clean).toHaveBeenCalled();
    });
  });

  describe('getSetStoriesPayload', () => {
    it('maps stories list to payload correctly', async () => {
      const store = new StoryStore({ importFn, globalMeta, fetchStoriesList });
      await store.initialize();

      expect(store.getSetStoriesPayload()).toMatchInlineSnapshot(`
        Object {
          "globalParameters": Object {},
          "globals": Object {
            "a": "b",
          },
          "kindParameters": Object {
            "Component One": Object {},
            "Component Two": Object {},
          },
          "stories": Object {
            "component-one--a": Object {
              "id": "component-one--a",
              "kind": "Component One",
              "name": "A",
              "parameters": Object {
                "fileName": "./src/ComponentOne.stories.js",
              },
            },
            "component-one--b": Object {
              "id": "component-one--b",
              "kind": "Component One",
              "name": "B",
              "parameters": Object {
                "fileName": "./src/ComponentOne.stories.js",
              },
            },
            "component-two--c": Object {
              "id": "component-two--c",
              "kind": "Component Two",
              "name": "C",
              "parameters": Object {
                "fileName": "./src/ComponentTwo.stories.js",
              },
            },
          },
          "v": 3,
        }
      `);
    });
  });
});