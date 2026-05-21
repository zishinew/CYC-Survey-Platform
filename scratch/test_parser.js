const parse = require('html-react-parser').default;
const React = require('react');

const textHtml = "<p>This is a <b>bold definition</b> test</p>";
const definitions = [{ term: "definition", definition: "the meaning" }];

const options = {
  replace: (domNode) => {
    if (domNode.type === 'text') {
      const data = domNode.data;
      // if data matches definition...
      // return parsed React elements
      console.log("TEXT NODE:", data);
    }
  }
};

const result = parse(textHtml, options);
console.log(result);
