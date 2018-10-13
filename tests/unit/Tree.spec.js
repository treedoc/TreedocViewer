import * as util from 'util'; // has no default export
import { Tree } from '../../src/models/Tree';

// import HelloWorld from '@/components/HelloWorld.vue';

describe('Tree', () => {
  const data = {
    root: {
      $type: 'RootClass',
      $hash: 'abcd0001',
      child1: [
        'array1',
        'array2',
      ],
      child2: {
        $type: 'Child2Class',
        $hash: 'abcd0002',
        child21: 'string',
        child22: true,
        child23: 123,
      },
    },
  };
  console.log(`tree=${util.inspect(Tree)}`);
  const tree = new Tree(data.root);
  console.log(tree.toString());
  // console.log(util.inspect(tree, true, 10, true));
  // console.log(`children=${util.inspect(tree.root.children, true, 10, true)}`);

  it('', () => {
    expect(tree.root.label).toMatch('root');
    expect(tree.root.children.child1.label).toMatch('child1');
  });
});
