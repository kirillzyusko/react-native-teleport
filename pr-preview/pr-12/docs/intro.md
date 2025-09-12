# Intro

## What is the portal?[​](#what-is-the-portal "Direct link to What is the portal?")

## Why another portal library for `react-native`?[​](#why-another-portal-library-for-react-native "Direct link to why-another-portal-library-for-react-native")

`react-native` [doesn't provide](https://github.com/facebook/react-native/issues/36273) a way to use `Portal`. You may be curious why another portal library for react-native is needed? We already have a plenty of choices, such as [@gorhom/portal](https://github.com/gorhom/react-native-portal), [react-gateway](https://github.com/cloudflare/react-gateway) etc.

However they all are JS-based solutions that stores React components in context. While this solution is great for simple cases, it has a few drawbacks:

* components are not rendered in the react-tree where component actually rendered;
* component may not get proper context values because views are literally rendered in a different
