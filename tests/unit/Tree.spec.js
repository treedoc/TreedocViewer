import {Tree, TreeNode} from '../../src/components/Tree';
import * as util from 'util'; // has no default export

//import HelloWorld from '@/components/HelloWorld.vue';

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
  const tree = new Tree(data);
  console.log(tree.toString());
  console.log(util.inspect(tree, true, 10, true));
  
  it('', () => {
    expect(tree.root.label).toMatch('root');
  });
});
