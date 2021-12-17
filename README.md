# Select Autosuggest

Another vanilla javascript library to replace the native select element with an autosuggest field.

## Features

Select autosuggest will transform select elements that will enable live filtering and fetches optional remote data from an endpoint.

- Written in vanilla js, no other framework is needed.
- Can use multiple instances during the setup.
- Compatible with both single and multiple select elements.
- Request and prepare optional remote data to include during the suggestions/selection.
- Optional base styles, Select autosuggest should function without the included stylesheet.
- Base keyboard functionality is included but you can always extend this with the optional callback handlers for each instance.

## Installation

You shoud include the minified javascript `dist/select-autosugges.min.js` before setting up an actual instance:

```
$ npm install @toolbarthomas/select-autosuggest
```

```html
<head>
  <script src="node_modules/@toolbarthomas/select-autosuggest/dist/select-autosugges.min.js"></script>
</head>
```

## Usage

Then you can define a new instance for one or multiple select elements:

```html
<script>
  // Ensure the actual library is loaded.
  window.addEventListener("DOMContentLoaded", (event) => {
    // SelectAutosuggest should be available within the window Object.
    const select = new SelectAutosuggest();

    select.start();
  });
</script>
```

## Options

| Option                       | Type     | Description                                                                                                                     |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| callback                     | object   | Include optional callbacks for the following events:                                                                            |
| callback.onClick             | function | Optional handler that will be called after the onClick event.                                                                   |
| callback.onDeselect          | function | Optional handler that will be called after a selection is removed.                                                              |
| callback.onDestroy           | function | Optional handler that will be called after the instance is destroyed.                                                           |
| callback.onDisplaySelection  | function | Optional handler that will be called after a selection has been made within the instance.                                       |
| callback.onDisplaySelections | function | Optional handler that will be called after the selections has been updated within the instance.                                 |
| callback.onEndpointException | function | Optional handler that will be called during an Endpoint exception.                                                              |
| callback.onFilter            | function | Optional handler that will be called after the onFilter event.                                                                  |
| callback.onFocus             | function | Optional handler that will be called after the onFocus event.                                                                   |
| callback.onKeyDown           | function | Optional handler that will be called after the onKeyDown event.                                                                 |
| callback.onKeyUp             | function | Optional handler that will be called after the onKeyUp event.                                                                   |
| callback.onRenderComplete    | function | Optional handler that will be called after the required elements have been rendered for the instance.                           |
| callback.onSelect            | function | Optional handler that will be called after an option is selected.                                                               |
| callback.onSubmit            | function | Optional handler that will be called after the onSubmit event.                                                                  |
| config                       | object   | The optional filter configuration.                                                                                              |
| config.filterName            | string   | The value for the filter name attribute, this will be included within the endpoint parameters.                                  |
| config.maxSuggestions        | number   | The amount of suggestions to display for the current instance.                                                                  |
| config.maxSuggestions        | number   | The amount of suggestions to display for the current instance. (Default 48)                                                     |
| config.method                | POST/GET | Defines the method for the XMLHttpRequest method.                                                                               |
| config.parameters            | object   | The optional parameters to send with the XMLHttpRequest.                                                                        |
| config.placeholder           | string   | The placeholder to display for the rendered filter element.                                                                     |
| config.transform             | function | Optional handler to transform the endpoint result into the expected format. (See the transform section for more information...) |
| endpoint                     | string   | Endpoint as URL to use within the actual remote data request.                                                                   |
| target                       | string   | Creates a new Select Autosuggest instance for the defined DOM selector.                                                         |

## Including Remote Data

You can also include remote data during the suggestion and selection within the instance. by assigning a global endpoint during the creation of a new Select AutoSuggest instance; or use the data attribute for each element `data-select-autosuggest-endpoint`.

Additional configuration can be used by defining the `config.parameters` during the setup of an instance.

The actual value of the current filter will also be inserted within the parameters of the request, the name attribute of this filter element is used as key. You can override the default id value for the name attribute within `config.filterName`.

## Transforming Remote Data

You may need to transform the optional remote data since the module requires the result to be placed into a nested array.

```json
{
  ...
  "eb27b06e148e7e47964a0c6d422d5fae": {
    "title": "Eggs",
    "value": "groceries_eggs"
  },
  ...
}
```

The above example could be the result for the defined remote endpoint and this needs to be transformed into a nested array with the label and it's value:

```js
// Should return an nested array from the result Object that was constructed in the above code snippet.
transform: (result) =>
  Object.values(result).map((row) => [row.title, row.value]);
```
