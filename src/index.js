class SelectAutosuggest {
  constructor(props) {
    const { delay, endpoint, target, config, NAMESPACE } = props || {};

    // Will be used to prefix all logic for the current instance.
    this.NAMESPACE = NAMESPACE || "select-autosuggest";

    // Alias for the actual class.
    this.name = this.constructor.name;

    // Implements the logic for the selected targets
    this.target = document.querySelectorAll(
      `${target}:not([data-${this.NAMESPACE}-id])`
    );

    // Caches the initiated selectors within the class instance.
    this.instances = {};

    // Define the global endpoint for the given instance.
    // The instance will use the target endpoint instead if there is no
    // global endpoint.
    this.endpoint = endpoint;

    // Defines the external request setup. Should contain the configuration for
    // XMLHTTPRequest or fetch API's.
    this.config = config;

    /**
     * Stores the throttled instances.
     */
    this.queue = {};

    /**
     * Gives the user some time in miliseconds to use the actual inputs.
     */
    this.delay = delay || 200;
  }

  /**
   * Initiates the defined instance targets.
   */
  start() {
    if (!this.target || !this.target.length) {
      console.log(`Unable to start ${this.name}, no elements have been found`);
      return;
    }

    for (let i = 0; i < this.target.length; i += 1) {
      // Prevent event stacking.
      if (this.target[i] && this.target[i][this.name]) {
        continue;
      }

      const id = this.subscribe(this.target[i]);

      this.renderTarget(this.target[i]);
      this.renderWrapper(this.target[i]);

      this.renderSuggestions(this.target[i]);

      this.renderFilter(this.target[i]);

      this.renderSelections(this.target[i]);

      this.listen(this.target[i]);

      // Prevent event stacking.
      this.target[i][this.name] = true;

      if (this.target[i].hasAttribute("multiple")) {
        this.displaySelections(id);
      } else {
        this.displaySelection(id);
      }
    }
  }

  /**
   * Destroys the autosuggest implementation for the defined subscriptions.
   *
   * @param {string} id Destroys the subscribed instance.
   */
  destroy(id) {
    if (!this.instances || !Object.keys(this.instances).length) {
      return;
    }

    if (!id) {
      Object.keys(this.instances).forEach((i) => this.destroy(i));

      return;
    }

    if (!this.instances[id]) {
      console.log(`Unable to destroy non-existing instance: ${id}`);

      return;
    }

    const {
      onFilter,
      onFocus,
      onKeyDown,
      onKeyUp,
      filter,
      suggestions,
      target,
      wrapper,
    } = this.instances[id];

    if (filter) {
      filter.removeEventListener("change", onFilter);
      filter.removeEventListener("focus", onFocus);
      filter.removeEventListener("keydown", onKeyDown);
      filter.removeEventListener("keyup", onKeyUp);
    }

    // Remove the rendered filter.
    filter.remove();

    // Remove the rendered suggestions
    suggestions.remove();

    // Move the actual target outside the rendered wrapper before we remove it.
    if (wrapper && wrapper.contains(target)) {
      wrapper.parentNode.insertBefore(target, wrapper.nextSibling);

      wrapper.remove();
    }

    target.removeAttribute(`${this.NAMESPACE}-id`);

    target.removeAttribute("tabindex");

    target.innerHTML = "";

    this.instances[id].initialValue.forEach((v) => {
      const [value, label] = v;
      const option = document.createElement("option");

      option.value = value;
      option.innerHTML = label;

      target.appendChild(option);

      // Trigger a change event to notify other modules the element has been
      // changed.
      target.dispatchEvent(new CustomEvent("change"));
    });

    // Remove the autosuggest enable flag.
    delete target[this.name];

    // Remove the subscribed instance.
    delete this.instances[id];
  }

  /**
   * Subscribes the given target element to the running instance.
   *
   * @param {HTMLSelectElement} target Subscribes the existing target element to
   * the current instance.
   */
  subscribe(target) {
    const isUnique =
      Object.values(this.instances).filter(
        (instance) => instance.target === target
      ).length === 0;

    if (!isUnique) {
      console.log(
        `Unable to subscribe element as select autosuggest instance.`
      );
      console.log("Target already exists:", target);
      return;
    }

    // Ensure the current target value does not exist as subscribed instance.
    let id = target.getAttribute(`${this.NAMESPACE}-id`) || target.id;

    if (!id || document.querySelector(`#${id}`) !== target) {
      id = this.generateID();

      console.log(`Unable to find existing ID, creating new ID: ${id}`);
    }

    console.log(
      `Element subscribed within the select autosuggest instance`,
      target
    );

    this.instances[id] = {
      selectedValues: [],
    };

    const initialValue = [];
    const option = target.querySelectorAll("option");
    if (option.length) {
      console.log(`Defining initial values for ${id}`);

      for (let i = 0; i < option.length; i += 1) {
        const value = option[i].getAttribute("value") || option[i].innerText;
        const label = option[i].innerText || option[i].getAttribute("value");

        if (option[i].hasAttribute("selected")) {
          this.instances[id].selectedValues = this.instances[
            id
          ].selectedValues.concat([[value, label]]);
        }

        initialValue.push([value, label]);
      }
    }

    // Assign the subscribed id to the element in order to proceed the
    // implementation.
    target.setAttribute(`${this.NAMESPACE}-id`, String(id));

    // Prevent Focus events for the selector.
    target.setAttribute("tabindex", "-1");

    this.instances[id]["target"] = target;
    this.instances[id]["initialValue"] = initialValue;

    return id;
  }

  /**
   * Displays the result from the filter field.
   *
   * @param {String} id Publishes the result for the selected instance id.
   */
  displaySelections(id) {
    if (!this.instances[id]) {
      console.log(
        `Unable to display selections for non-existing instance: ${id}`
      );

      return;
    }

    if (
      this.instances[id].selectedValues &&
      this.instances[id].selectedValues.length
    ) {
      const fragment = document.createDocumentFragment();

      this.instances[id].selectedValues.forEach((v, index) => {
        const [value, label] = v;
        const button = document.createElement("button");
        button.classList.add(`${this.NAMESPACE}__selection`);
        button.innerHTML = label;
        const tag = `data-${this.NAMESPACE}-value`;
        button.setAttribute(tag, value);

        button.addEventListener("click", (event) => {
          event.preventDefault();

          this.deselect(id, [value, label]);
        });

        fragment.appendChild(button);
      });

      this.instances[id].selections.innerHTML = "";
      this.instances[id].selections.appendChild(fragment);
    } else {
      this.instances[id].selections.innerHTML = "";
    }
  }

  /**
   * Displays the single selection within the filter element.
   *
   * @param {String} id Publishes the result for the selected instance id.
   */
  displaySelection(id) {
    if (!this.instances[id] || !this.instances[id].filter) {
      console.log("Unable to display selection within non-existing filter..");

      return;
    }

    if (
      !this.instances[id].selectedValues ||
      !this.instances[id].selectedValues.length
    ) {
      return;
    }

    this.instances[id].preventFilter = true;

    this.instances[id].filter.value = this.instances[id].selectedValues[0][1];

    this.instances[id].preventFilter = false;
  }

  /**
   * Displays the result from the filter field.
   *
   * @param {String} id Publishes the result for the selected instance id.
   */
  displaySuggestions(id) {
    if (!this.instances[id]) {
      console.log(`Unable to publish non-existing instance: ${id}`);

      return;
    }

    console.log(this.instances[id].suggestedValues);

    if (
      this.instances[id].suggestedValues &&
      this.instances[id].suggestedValues.length
    ) {
      const fragment = document.createDocumentFragment();

      // Define the max amount of results.
      if (
        this.config &&
        !isNaN(parseFloat(this.config.maxSuggestions)) &&
        this.config.maxSuggestions < this.instances[id].suggestedValues.length
      ) {
        console.log(
          `Using maximum suggestion amount: ${this.config.maxSuggestions}`
        );

        this.instances[id].suggestedValues = this.instances[
          id
        ].suggestedValues.slice(0, this.config.maxSuggestions);
      }

      this.instances[id].suggestedValues.forEach((val, index) => {
        const [value, label] = val;

        console.log("selected", value);

        if (
          this.instances[id].selectedValues &&
          this.instances[id].selectedValues.filter((v) => v[0] === value).length
        ) {
          console.log(`Filter duplicate: ${value}`);
          return;
        }

        const button = document.createElement("button");
        button.classList.add(`${this.NAMESPACE}__suggestion`);
        button.innerHTML = label;
        button.setAttribute(`data-${this.NAMESPACE}-value`, value);

        button.addEventListener("click", (event) => {
          event.preventDefault();

          this.select(id, index);
        });

        fragment.appendChild(button);
      });

      this.instances[id].suggestions.innerHTML = "";
      this.instances[id].suggestions.appendChild(fragment);
    } else {
      this.instances[id].suggestions.innerHTML = "";
    }
  }

  /**
   * Updates the subscribed instance.
   *
   * @param {String} id The id of the subscribed target.
   * @param {Object} proposal Safely merges the optional Object properties to
   * the subscribed instance.
   */
  update(id, proposal) {
    // Ensure the accepted properties are only inherited.
    const {
      filter,
      onFilter,
      onFocus,
      onKeyDown,
      onKeyUp,
      selections,
      suggestions,
      wrapper,
    } = proposal;
    const commit = {};
    if (filter) {
      commit.filter = filter;
    }

    if (onFilter) {
      commit.onFilter = onFilter;
    }

    if (onFocus) {
      commit.onFocus = onFocus;
    }

    if (onKeyDown) {
      commit.onKeyDown = onKeyDown;
    }

    if (onKeyUp) {
      commit.onKeyUp = onKeyUp;
    }

    if (selections) {
      commit.selections = selections;
    }

    if (suggestions) {
      commit.suggestions = suggestions;
    }

    if (wrapper) {
      commit.wrapper = wrapper;
    }

    if (this.instances[id] instanceof Object) {
      console.log("Updating subscribed instance:", commit);

      this.instances[id] = Object.assign(this.instances[id], commit);

      console.log("Instance updated:", this.instances[id]);
    }
  }

  /**
   * Implements the required styles for the defined target.
   *
   * @param {HTMLElement} target Implements the style for the current target.
   */
  renderTarget(target) {
    if (!target) {
      Object.values(this.instances).forEach((instance) =>
        this.renderTarget(instance.target)
      );

      return;
    }

    target.style["position"] = "absolute";
    target.style["clip"] = "rect(1px, 1px, 1px, 1px)";
    target.style["overflow"] = "hidden";
    target.style["height"] = "1px";
    target.style["width"] = "1px";
    target.style["word-wrap"] = "normal";
    target.style["text-transform"] = "initial";
    target.style["margin-top"] = "-1px";
    target.style["margin-left"] = "-1px";
  }

  /**
   * Wraps the selected target element with a container element.
   *
   * @param {HTMLElement} target The HTMLElement that will be wrapped.
   */
  renderWrapper(target) {
    if (!target) {
      Object.values(this.instances).forEach((instance) =>
        this.renderWrapper(instance.target)
      );

      return;
    }

    const id = this.filterTargetID(target);
    if (
      target.parentNode &&
      target.parentNode ===
        document.querySelector(
          `.${this.NAMESPACE}__wrapper[data-${this.NAMESPACE}-wrapper-id="${id}"]`
        )
    ) {
      console.log("Skipping wrapper render for target:", target);

      return;
    }
    console.log("Rendering wrapper for target:", target);

    // Prepare the filter element.
    const wrapper = document.createElement("div");

    wrapper.setAttribute(`data-${this.NAMESPACE}-wrapper-id`, id);
    wrapper.classList.add(`${this.NAMESPACE}__wrapper`);

    // Insert the wrapper before the target element.
    target.parentNode.insertBefore(wrapper, target.nextSibling);

    // Update the actual target in order to render the rest correctly.
    wrapper.appendChild(target);

    // Update the subscribed element instance.
    this.update(id, {
      wrapper,
    });
  }

  /**
   * Initiate the render for a specific element or for all subscribed instances.
   *
   * @param {HTMLElement} target Applies the render for the subscribed target
   * element.
   */
  renderFilter(target) {
    if (!target) {
      Object.values(this.instances).forEach((instance) =>
        this.renderFilter(instance.target)
      );

      return;
    }

    const id = this.filterTargetID(target);

    if (
      target.parentNode &&
      target.parentNode.querySelectorAll(
        `.${this.NAMESPACE}__filter[data-${this.NAMESPACE}-filter-id="${id}"]`
      ).length
    ) {
      console.log("Skipping filter render for target:", target);

      return;
    }

    console.log("Rendering filter:", target);

    // Prepare the filter element.
    const filter = document.createElement("input");

    filter.setAttribute(`data-${this.NAMESPACE}-filter-id`, id);
    filter.classList.add(`${this.NAMESPACE}__filter`);
    const placeholder = target.getAttribute(
      `data-${this.NAMESPACE}-placeholder`
    );

    if (placeholder && placeholder.length) {
      filter.setAttribute("placeholder", placeholder);
    } else if (this.config && this.config.placeholder)
      filter.setAttribute("placeholder", this.config.placeholder);
    {
    }

    // Render the actual filter input.
    target.parentNode.insertBefore(filter, target.nextSibling);

    // Update the subscribed element instance.
    this.update(id, {
      filter,
    });
  }

  /**
   * Renders the target selections wrapper.
   *
   * @param {HTMLElement} target Applies the render for the subscribed target
   * element.
   */
  renderSelections(target) {
    if (!target) {
      Object.values(this.instances).forEach((instance) =>
        this.renderSelections(instance.target)
      );

      return;
    }

    const id = this.filterTargetID(target);

    if (
      target.parentNode &&
      target.parentNode.querySelectorAll(
        `.${this.NAMESPACE}__selection[data-${this.NAMESPACE}-selection-id="${id}"]`
      ).length
    ) {
      console.log("Skipping selection render for target:", target);

      return;
    }

    if (!this.instances[id].target.hasAttribute("multiple")) {
      return;
    }

    console.log("Rendering selection:", target);

    // Prepare the filter element.
    const selections = document.createElement("div");

    selections.setAttribute(`data-${this.NAMESPACE}-selections-id`, id);
    selections.classList.add(`${this.NAMESPACE}__selections`);

    // Render the actual selections input.
    target.parentNode.insertBefore(selections, target.nextSibling);

    // Update the subscribed element instance.
    this.update(id, {
      selections,
    });
  }

  /**
   * Renders the target suggestions wrapper.
   *
   * @param {HTMLElement} target Applies the render for the subscribed target
   * element.
   */
  renderSuggestions(target) {
    if (!target) {
      Object.values(this.instances).forEach((instance) =>
        this.renderSuggestions(instance.target)
      );

      return;
    }

    const id = this.filterTargetID(target);

    if (
      target.parentNode &&
      target.parentNode.querySelectorAll(
        `.${this.NAMESPACE}__suggestions[data-${this.NAMESPACE}-suggestions-id="${id}"]`
      ).length
    ) {
      console.log("Skipping suggestions render for target:", target);

      return;
    } else {
      console.log("Rendering suggestions:", target);

      // Prepare the filter element.
      const suggestions = document.createElement("div");

      suggestions.setAttribute(`data-${this.NAMESPACE}-suggestions-id`, id);
      suggestions.classList.add(`${this.NAMESPACE}__suggestions`);

      // Render the actual suggestions input.
      target.parentNode.insertBefore(suggestions, target.nextSibling);

      // Update the subscribed element instance.
      this.update(id, {
        suggestions,
      });
    }
  }

  /**
   * Updates the options for the selected target.
   */
  updateTarget(target) {
    if (!target) {
      Object.values(this.instances).forEach((instance) =>
        this.updateTarget(instance.target)
      );

      return;
    }

    const id = this.filterTargetID(target);

    // Ensure the target is empty.
    target.innerHTML = "";

    if (
      !this.instances[id].selectedValues ||
      !this.instances[id].selectedValues.length
    ) {
      return;
    }

    this.instances[id].selectedValues.forEach((v) => {
      const [value, label] = v;
      const option = document.createElement("option");

      option.setAttribute("selected", "selected");
      option.value = value;
      option.innerHTML = label;

      target.appendChild(option);

      // Trigger a change event to notify other modules the element has been
      // changed.
      target.dispatchEvent(new CustomEvent("change"));
    });
  }

  /**
   * Assigns the required Event listeners for the selected target element.
   *
   * @param {HTMLElement} target Implements the Event listeners for the
   * subscribed target element.
   */
  listen(target) {
    if (!target) {
      Object.values(this.instances).forEach((instance) =>
        this.listen(instance.target)
      );

      return;
    }

    const id = this.filterTargetID(target);

    const instance = this.instances[id];
    const cacheTag = `data-${this.NAMESPACE}-cached-value`;
    const endpointTag = `data-${this.NAMESPACE}-endpoint`;
    const configTag = `data-${this.NAMESPACE}-config`;
    let config = this.config;

    try {
      const inlineConfig = this.instances[id].target.getAttribute(configTag)
        ? JSON.parse(this.instances[id].target.getAttribute(configTag))
        : this.config;

      if (inlineConfig) {
        console.log(`Using inline config for ${id}...`);
        config = Object.assign(inlineConfig, this.config);
      }
    } catch (exception) {
      console.log(exception);
    }

    const endpoint = this.instances[id].target.getAttribute(endpointTag)
      ? this.instances[id].target.getAttribute(endpointTag)
      : this.endpoint;

    if (instance.onFilter && instance.filter) {
      instance.filter.removeEventListener("change", instance.onFilter);
    }

    if (instance.onFocus && instance.filter) {
      instance.filter.removeEventListener("focus", instance.onFocus);
    }

    if (instance.onKeyDown && instance.filter) {
      instance.filter.removeEventListener("keydown", instance.onKeyDown);
    }

    if (instance.onKeyUp && instance.filter) {
      instance.filter.removeEventListener("keyup", instance.onKeyUp);
    }

    if (instance.filter) {
      this.update(id, {
        onFilter: (event) => {
          // Prevent a secondary filters that is inherited from other input
          // events.
          const cachedValue = instance.filter.getAttribute(cacheTag);
          if (cachedValue && cachedValue === instance.filter.value) {
            return;
          }

          if (this.instances[id].preventFilter) {
            return;
          }

          this.handleEnpoint(
            id,
            endpoint,
            event.target.value,
            (result, status) => {
              const suggestedValues = this.filterValues(
                id,
                instance.filter.value,
                result
              );

              if (suggestedValues) {
                console.log(
                  `Updating suggestions for ${id}: ${instance.filter.value}`
                );

                this.instances[id].suggestedValues = suggestedValues;
              }

              this.displaySuggestions(id);
            },
            config
          );
        },
        onFocus: (event) => {
          if (!event.target.value) {
            // @todo implement cached ajax.
            // Ignore the endpoint suggestions during the initial focus.
            const suggestedValues = this.filterValues(id, "", []);

            this.instances[id].suggestedValues = suggestedValues;

            this.displaySuggestions(id);
          }
        },
        onKeyDown: (event) => {
          if (this.catchKey(event)) {
            console.log("keydown");
          }
        },
        onKeyUp: (event) => {
          if (this.catchKey(event) == null) {
            instance.filter.blur();
          }

          if (!this.catchKey(event)) {
            return;
          }

          if (event.keyCode === 13) {
            if (!instance.filter.value.length) {
              return;
            }

            // Prevent accidental form submits.
            event.preventDefault();

            console.log(`Handle select from return: ${id}`);

            instance.filter.dispatchEvent(new CustomEvent("change"));

            return this.select(id);
          }

          // Should delay enought to give enough time to filter.
          this.throttle(id, () => {
            const cachedValue = instance.filter.getAttribute(cacheTag);

            if (!cachedValue && instance.filter.value) {
              instance.filter.dispatchEvent(new CustomEvent("change"));
            } else if (cachedValue && cachedValue !== instance.filter.value) {
              instance.filter.dispatchEvent(new CustomEvent("change"));
            }

            instance.filter.setAttribute(cacheTag, instance.filter.value);
          });
        },
      });

      instance.filter.addEventListener("change", this.instances[id].onFilter);

      instance.filter.addEventListener("focus", this.instances[id].onFocus);

      instance.filter.addEventListener("keydown", this.instances[id].onKeyDown);

      instance.filter.addEventListener("keyup", this.instances[id].onKeyUp);
    }
  }

  /**
   * Selects from the current suggestions.
   *
   * @param {String} id Selects from the subscribed id.
   * @param {Number} index Select the defined index or the first.
   */
  select(id, index) {
    if (
      this.instances[id] &&
      Array.isArray(this.instances[id].suggestedValues)
    ) {
      const selectedValue = this.instances[id].suggestedValues[index]
        ? this.instances[id].suggestedValues[index]
        : this.instances[id].suggestedValues[0];

      if (this.instances[id].target.hasAttribute("multiple")) {
        this.instances[id].preventFilter = true;

        this.instances[id].filter.value = "";

        this.instances[id].preventFilter = false;

        if (!Array.isArray(this.instances[id].selectedValues)) {
          this.instances[id].selectedValues = [];
        }

        if (!this.instances[id].selectedValues.includes(selectedValue)) {
          this.instances[id].selectedValues = [selectedValue].concat(
            this.instances[id].selectedValues
          );
        } else {
          this.instances[id].selectedValues = this.instances[id].selectedValues;
        }
      } else {
        this.instances[id].selectedValues = [selectedValue];
      }
    }

    // Update the instance target.
    this.updateTarget(this.instances[id].target);

    if (this.instances[id].target.hasAttribute("multiple")) {
      // Display the selected suggestions
      this.displaySelections(id);
    } else {
      this.displaySelection(id);
    }

    // Filter out the selected suggestion.
    this.displaySuggestions(id);
  }

  /**
   * Removes the defined value from the selected values for the current instance.
   *
   * @param {String} id Deselects from the subscribed id.
   * @param {Array} selection The selection to remove.
   */
  deselect(id, selection) {
    if (!id || !this.instances[id]) {
      console.log(`Unable to deselect for non-existing id: ${id}`);
    }

    if (!this.instances[id] || !this.instances[id].selectedValues.length) {
      return;
    }

    // Deselects all values for the defined target.
    if (!Array.isArray(selection)) {
      console.log(`Removing all selections`);

      return this.instances[id].selectedValues.forEach((selectedValue) =>
        this.deselect(id, selectedValue)
      );
    }

    const commit = this.instances[id].selectedValues.filter(
      (selectedValue) => selectedValue[0] !== selection[0]
    );

    console.log(`Removed selection: ${selection[1]} => ${selection[0]}`);

    this.instances[id].selectedValues = commit;

    // Update the instance target.
    this.updateTarget(this.instances[id].target);

    if (this.instances[id].target.hasAttribute("multiple")) {
      // Display the selected suggestions
      this.displaySelections(id);
    } else {
      this.displaySelection(id);
    }

    // Filter out the selected suggestion.
    this.displaySuggestions(id);
  }

  /**
   * Throttles the given event handler.
   *
   * @param {String} id The subscribed id that should match
   *
   * @param {Function} handler
   */
  throttle(id, handler) {
    if (!this.instances[id]) {
      console.log(`Unable to throttle non existing instance: ${id}`);
    }

    if (this.queue[id]) {
      clearTimeout(this.queue[id]);
    }

    this.queue[id] = setTimeout(handler, this.delay);
  }

  /**
   * Prevents certain keys from triggering the default handler.
   *
   * @param {InputEvent} event The event to catch.
   */
  catchKey(event) {
    const { keyCode } = event;

    if (keyCode === 27) {
      return null;
    }

    if ([9, 16, 17, 18].includes(keyCode)) {
      return false;
    }

    return true;
  }

  /**
   * Create the actual suggestions Array based.
   *
   * @param {String} id Filters the initial values from the subscribed id.
   *
   * @param {String} query Filters out the proposed suggestions if defined.
   *
   * @param {Array} proposal Optional filter that would come from API suggestions.
   */
  filterValues(id, query, proposal) {
    if (!this.instances[id]) {
      console.log(`Unable to filter non exsiting instance: ${id}`);
    }

    let suggestions = this.instances[id].initialValue.concat(
      Array.isArray(proposal) ? proposal : []
    );

    if (query && query.length) {
      suggestions = suggestions
        .filter((f) => Array.isArray(f))
        .filter((f) => {
          const [value, label] = f;

          return (
            String(value).toLowerCase() === String(query).toLowerCase() ||
            label.toLowerCase().includes(query.toLowerCase())
          );
        });
    }

    return suggestions;
  }

  /**
   * Interacts with the defined endpoint and returns the defined result.
   *
   * @param {String} endpoint The public path to interact with.
   */
  handleEnpoint(id, endpoint, query, handler, config) {
    if (this.instances[id].preventFilter) {
      return;
    }

    this.instances[id].preventFilter = true;

    if (!query || query.length < 2) {
      this.instances[id].preventFilter = false;

      return handler([]);
    }

    const request = new XMLHttpRequest();

    const c = config || {};
    request.open(c.method || "POST", endpoint, true);

    request.onload = function () {
      if (this.status >= 200 && this.status < 400) {
        let response;

        try {
          response = JSON.parse(this.response);
        } catch (error) {
          console.log(`Unable to parse response from: ${query}`);
        }

        console.log("response", response, c.transform);

        if (response) {
          if (c.transform) {
            console.log(`Transforming response...`);

            let transformedResponse;
            try {
              transformedResponse = c.transform(response);
            } catch (error) {
              console.log(`Unable to transform response: ${error}`);
            }

            if (Array.isArray(transformedResponse)) {
              return handler(transformedResponse);
            }
          } else {
            return handler(response);
          }
        } else {
          handler([]);
        }
      } else {
        console.log(`Unable to use endpoint: ${this.statusText}`);
      }
    };

    request.onloadstart = () => {
      if (this.instances[id].wrapper) {
        this.instances[id].wrapper.setAttribute("aria-busy", true);
      }
    };

    request.onerror = function () {
      console.log(`Unable to use endpoint: ${this.statusText}`);
    };

    request.onloadend = () => {
      this.instances[id].preventFilter = false;

      if (this.instances[id].wrapper) {
        // this.instances[id].wrapper.removeAttribute("aria-busy");
      }
    };

    request.send();
  }

  /**
   * Returns the subscribed id from the given target element.
   *
   * @param {HTMLElement} target Returns the id of the defined target from the
   * subscribed instances.
   */
  filterTargetID(target) {
    return Object.keys(this.instances).filter(
      (instance) =>
        this.instances[instance] && this.instances[instance].target === target
    )[0];
  }

  /**
   * Generates an unique string id.
   */
  generateID() {
    let id = `${this.NAMESPACE}-${Math.random().toString(36).substr(2, 9)}`;

    if (this.instances[id]) {
      id = this.generateID();
    }

    return id;
  }
}
