# Styleguide

!! TABS ARE TO BE USED ACROSS THE PROJECT. NO SPACES ALLOWED FOR INDENTATION. !!

## Javascript
- This is a Node.js project, so the use of ES6/7 is encouraged.
- JS variables names are `camelCase`.
- JS variables should be defined with `const` unless they are mutated, then use `let`. A good rule of thumb - define every variable as `const` until you need them to be mutable, then update to `let`. Using `var` is banned.
- It is preferred to use `async/await` for handling Promises.

## Routes
- Routes are singular. (/controller, /event)
- Use the correct HTTP methods (for basic CRUD: Create - POST, Read - GET, Update - PUT, Delete - DELETE)
- Keep routes as brief as possible (`PUT /controller/[cid]/update` is better expressed as `PUT /controller/[cid]`)

# Conclusion
This is a living document that may be updated as needed. This document may be updated like any other part of the project (clone, branch, push, merge request).