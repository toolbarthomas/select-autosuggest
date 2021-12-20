(function defineSelectAutosuggest(root) {
  // Figure out the issue where an click is handled during the enter within an input element.
  class SelectAutosuggest {
    constructor(props) {
      const {
        delay,
        endpoint,
        target,
        callback,
        config,
        context,
        silent,
        NAMESPACE,
      } = props || {};

      // Will be used to prefix all logic for the current instance.
      this.NAMESPACE = NAMESPACE || "select-autosuggest";

      // Alias for the actual class.
      this.name = this.constructor.name;

      // Define the given context the select the actual element.
      this.context = context || document;

      // Implements the logic for the selected targets
      this.target = this.context.querySelectorAll(
        `${target || ".select-autosuggest"}:not([data-${this.NAMESPACE}-id])`
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

      // Defines the optional callback handlers for the assigned events.
      this.callback = callback || {};

      // Stores the throttled instances.
      this.queue = {};

      // Gives the user some time in miliseconds to use the actual inputs.
      this.delay = delay || 200;

      // Prevents non important logging.
      this.silent = silent;
    }

    /**
     * Initiates the defined instance targets.
     */
    start() {
      if (!this.target || !this.target.length) {
        this.error(`Unable to start ${this.name}, no elements have been found`);
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
        this.renderFilter(this.target[i]);
        this.renderSuggestions(this.target[i]);
        this.renderSelections(this.target[i]);

        this.handleCallback("onRenderComplete", id, this.target[i]);

        this.defineForm(this.target[i]);

        this.listen(this.target[i]);

        // Prevent event stacking.
        this.target[i][this.name] = true;

        if (this.target[i].hasAttribute("multiple")) {
          this.displaySelections(id);
        } else {
          this.displaySelection(id);
        }

        // Ensure the suggestions are hidden during the initial load.
        this.collapse(id);
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
        this.error(`Unable to destroy non-existing instance: ${id}`);

        return;
      }

      const {
        onBlur,
        onClick,
        onFilter,
        onFocus,
        onKeyDown,
        onKeyUp,
        onSubmit,
        filter,
        suggestions,
        target,
        wrapper,
      } = this.instances[id];

      if (filter) {
        if (onBlur) {
          filter.removeEventListener("blur", onBlur);
        }

        if (onFilter) {
          filter.removeEventListener("change", onFilter);
        }

        if (onFocus) {
          filter.removeEventListener("focus", onFocus);
        }

        if (onKeyDown) {
          filter.removeEventListener("keydown", onKeyDown);
        }

        if (onKeyUp) {
          filter.removeEventListener("keyup", onKeyUp);
        }
      }

      if (onClick) {
        document.removeEventListener("click", onClick);
      }

      // Move the actual target outside the rendered wrapper before we remove it.
      if (wrapper && wrapper.contains(target)) {
        wrapper.parentNode.insertBefore(target, wrapper.nextSibling);

        wrapper.remove();
      }

      target.removeAttribute(`${this.NAMESPACE}-id`);

      target.removeAttribute("tabindex");

      target.innerHTML = "";

      // Remember the existing selections.
      if (this.instances[id].selectedValues.length) {
        this.instances[id].selectedValues.forEach((v) => {
          const [value, label] = v;
          const option = document.createElement("option");

          option.selected = "true";

          option.value = value;
          option.innerHTML = label;

          target.appendChild(option);
        });
      }

      if (this.instances[id].initialValue.length) {
        this.instances[id].initialValue.forEach((v) => {
          const [value, label] = v;

          if (this.context.querySelector(`option[value=${value}]`)) {
            return;
          }

          const option = document.createElement("option");

          option.value = value;
          option.innerHTML = label;

          target.appendChild(option);
        });
      }

      // Trigger a change event to notify other modules the element has been
      // changed.
      target.dispatchEvent(new CustomEvent("change"));

      target.removeAttribute("style");

      target.removeAttribute("tabindex");

      this.handleCallback("onDestroy", id, target);

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
        this.error(
          `Unable to subscribe element as select autosuggest instance.`
        );
        this.error("Target already exists:", target);
        return;
      }

      // Ensure the current target value does not exist as subscribed instance.
      let id = target.getAttribute(`${this.NAMESPACE}-id`) || target.id;

      if (!id || this.context.querySelector(`#${id}`) !== target) {
        id = this.generateID();

        this.log(`Unable to find existing ID, creating new ID: ${id}`);
      }

      this.instances[id] = {
        selectedValues: [],
      };

      const initialValue = [];
      const option = target.querySelectorAll("option");
      if (option.length) {
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

      this.update(id, {
        target,
        initialValue,
      });

      // this.instances[id]["target"] = target;
      // this.instances[id]["initialValue"] = initialValue;

      return id;
    }

    /**
     * Displays the result from the filter field.
     *
     * @param {String} id Publishes the result for the selected instance id.
     * @param {String} initialValue Use initial value to focus the next selection.
     */
    displaySelections(id, initialValue) {
      if (!this.instances[id]) {
        this.error(
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
          if (!v) {
            return;
          }

          const [value, label] = v;
          const button = document.createElement("button");

          button.classList.add(`${this.NAMESPACE}__selection`);
          button.innerHTML = label;
          const tag = `data-${this.NAMESPACE}-value`;
          button.setAttribute(tag, value);

          // @todo figure out click from enter on submit
          button.addEventListener("click", (event) => {
            event.preventDefault();

            // @todo Probably not needed anymore
            // Prevent filter from keyboard callbacks.
            // if (this.instances[id].preventUpdate) {
            //   this.instances[id].preventUpdate = false;
            //   return;
            // }

            this.deselect(id, [value, label]);
          });

          // Assign the Blur collapse logic for the new selection.
          if (this.instances[id].onBlur) {
            button.addEventListener("blur", (event) =>
              this.instances[id].onBlur(event)
            );
          }

          fragment.appendChild(button);
        });

        const list = document.createElement("div");
        list.classList.add(`${this.NAMESPACE}__selections-list`);
        list.appendChild(fragment);

        this.instances[id].selections.innerHTML = "";
        this.instances[id].selections.appendChild(list);

        // Keep focus within the selection list.
        if (initialValue) {
          if (list.firstElementChild) {
            list.firstElementChild.focus();
          }
        }
      } else {
        this.instances[id].selections.innerHTML = "";
      }

      this.handleCallback("onDisplaySelections", id, this.instances[id].target);
    }

    /**
     * Displays the single selection within the filter element.
     *
     * @param {String} id Publishes the result for the selected instance id.
     */
    displaySelection(id) {
      if (!this.instances[id] || !this.instances[id].filter) {
        this.error("Unable to display selection within non-existing filter..");

        return;
      }

      if (
        !this.instances[id].selectedValues ||
        !this.instances[id].selectedValues.length
      ) {
        return;
      }

      // this.instances[id].preventFilter = true;

      this.update(id, {
        preventFilter: true,
      });

      this.instances[id].filter.value = this.instances[id].selectedValues[0][1];

      this.update(id, {
        preventFilter: false,
      });

      this.handleCallback("onDisplaySelection", id, this.instances[id].target);

      // this.instances[id].preventFilter = false;
    }

    /**
     * Displays the result from the filter field.
     *
     * @param {String} id Publishes the result for the selected instance id.
     * @param {String} initialValue Use initial value to focus the next suggestion.
     */
    displaySuggestions(id, initialValue) {
      this.validateCollapse(id);

      if (!this.instances[id]) {
        this.error(`Unable to publish non-existing instance: ${id}`);

        return;
      }
      // Use the nextIndex to focus the next suggestion.
      let nextIndex;

      if (
        this.instances[id].suggestedValues &&
        this.instances[id].suggestedValues.length
      ) {
        const fragment = document.createDocumentFragment();
        const list = document.createElement("div");

        list.classList.add(`${this.NAMESPACE}__suggestions-list`);

        // Define the max amount of results.
        if (
          this.config &&
          !isNaN(parseFloat(this.config.maxSuggestions)) &&
          this.config.maxSuggestions < this.instances[id].suggestedValues.length
        ) {
          this.log(
            `Using maximum suggestion amount: ${this.config.maxSuggestions}`
          );

          this.update(id, {
            suggestedValues: this.instances[id].suggestedValues.slice(
              0,
              this.config.maxSuggestions
            ),
          });

          // this.instances[id].suggestedValues = this.instances[
          //   id
          // ].suggestedValues.slice(0, this.config.maxSuggestions);
        }

        this.instances[id].suggestedValues.forEach((val, index) => {
          if (!Array.isArray(val)) {
            return;
          }

          const [value, label] = val;

          if (value === initialValue) {
            nextIndex = index;
          }

          // Filter out the already selected suggestions.
          if (
            this.instances[id].selectedValues &&
            this.instances[id].selectedValues.filter((v) => v[0] === value)
              .length
          ) {
            return;
          }

          const button = document.createElement("button");
          button.classList.add(`${this.NAMESPACE}__suggestion`);
          button.innerHTML = label;
          button.setAttribute(`data-${this.NAMESPACE}-value`, value);

          button.addEventListener("click", (event) => {
            event.preventDefault();

            // @todo Probably not needed anymore..
            // Prevent filter from keyboard callbacks.
            // if (this.instances[id].preventUpdate) {
            //   this.instances[id].preventUpdate = false;
            //   return;
            // }

            this.select(id, index, value);
          });

          // Assign the Blur collapse logic for the new selection.
          if (this.instances[id].onBlur) {
            button.addEventListener("blur", (event) =>
              this.instances[id].onBlur(event)
            );
          }

          fragment.appendChild(button);
        });

        list.appendChild(fragment);

        this.instances[id].suggestions.innerHTML = "";
        this.instances[id].suggestions.appendChild(list);

        if (!list.children.length) {
          this.collapse(id);
        } else {
          this.expand(id);
        }

        // Keep focus within the suggestion list.
        if (nextIndex != null) {
          if (nextIndex > list.children.length) {
            nextIndex = list.children.length - 1;
          }

          const nextElement = list.children[nextIndex < 1 ? 0 : nextIndex - 1];

          if (nextElement) {
            nextElement.focus();
          }
        }
      } else {
        this.instances[id].suggestions.innerHTML = "";

        this.collapse(id);
      }

      this.handleCallback(
        "onDisplaySuggestions",
        id,
        this.instances[id].target
      );
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
        form,
        filter,
        filterWrapper,
        onBlur,
        onClick,
        onFilter,
        onFocus,
        onKeyDown,
        onKeyUp,
        preventCollapse,
        preventFilter,
        preventSubmit,
        preventUpdate,
        selections,
        selectedValues,
        suggestions,
        suggestedValues,
        wrapper,
        initialValue,
        target,
      } = proposal;
      const commit = {};

      if (form) {
        commit.form = form;
      }

      if (filter) {
        commit.filter = filter;
      }

      if (onBlur) {
        commit.onBlur = onBlur;
      }

      if (onClick) {
        commit.onClick = onClick;
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

      if (filterWrapper) {
        commit.filterWrapper = filterWrapper;
      }

      if (this.instances[id] instanceof Object) {
        if (Object.values(commit).length) {
          this.log(`Updating instance ${id}:`, Object.keys(commit).join(", "));

          // Only define the allowed properties.
          this.instances[id] = Object.assign(this.instances[id], commit);
        }

        // Ensure the following properties can be updated.
        if (preventCollapse != null) {
          this.instances[id].preventCollapse = preventCollapse;
        }

        if (preventFilter != null) {
          this.instances[id].preventFilter = preventFilter;
        }

        if (preventSubmit != null) {
          this.instances[id].preventSubmit = preventSubmit;
        }

        if (preventUpdate != null) {
          this.instances[id].preventUpdate = preventUpdate;
        }

        if (target != null) {
          this.instances[id].target = target;
        }

        if (initialValue != null) {
          this.instances[id].initialValue = initialValue;
        }

        if (selectedValues != null) {
          this.instances[id].selectedValues = selectedValues;
        }

        if (suggestedValues != null) {
          this.instances[id].suggestedValues = suggestedValues;
        }
      }
    }

    /**
     * Defines the form element for the given target.
     * @param {HTMLElement} target Defines the form from the selected element.
     */
    defineForm(target) {
      if (!target) {
        Object.values(this.instances).forEach((instance) =>
          this.defineForm(instance.target)
        );

        return;
      }

      const id = this.filterTargetID(target);

      // @todo should be form from target instead.
      const form = this.context.querySelector("form");

      if (!form) {
        return;
      }

      // Update the subscribed element instance.
      this.update(id, {
        form,
      });
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

      target.setAttribute("tabindex", "-1");

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
          this.context.querySelector(
            `.${this.NAMESPACE}-wrapper[data-${this.NAMESPACE}-wrapper-id="${id}"]`
          )
      ) {
        this.log("Skipping wrapper render for target:", target);
        return;
      }

      // Prepare the filter element.
      const wrapper = document.createElement("div");

      wrapper.setAttribute(`data-${this.NAMESPACE}-wrapper-id`, id);
      wrapper.classList.add(`${this.NAMESPACE}-wrapper`);

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
        this.log("Skipping filter render for target:", target);

        return;
      }

      // Prepare the filter element.
      const filter = document.createElement("input");
      const filterWrapper = document.createElement("div");
      filterWrapper.classList.add(`${this.NAMESPACE}__filter-wrapper`);

      if (this.config && this.config.filterName) {
        filter.setAttribute("name", this.config.filterName);
      }

      filter.setAttribute(`data-${this.NAMESPACE}-filter-id`, id);
      filter.setAttribute("autocomplete", "off");
      filter.classList.add(`${this.NAMESPACE}__filter`);
      const placeholder = target.getAttribute(
        `data-${this.NAMESPACE}-placeholder`
      );

      if (placeholder && placeholder.length) {
        filter.setAttribute("placeholder", placeholder);
      } else if (this.config && this.config.placeholder) {
        filter.setAttribute("placeholder", this.config.placeholder);
      }

      filterWrapper.appendChild(filter);

      // Render the actual filter input.
      target.parentNode.insertBefore(filterWrapper, target.nextSibling);

      // Update the subscribed element instance.
      this.update(id, {
        filter,
        filterWrapper,
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
        this.log("Skipping selection render for target:", target);

        return;
      }

      if (!this.instances[id].target.hasAttribute("multiple")) {
        return;
      }

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
        this.log("Skipping suggestions render for target:", target);

        return;
      } else {
        // Prepare the filter element.
        const suggestions = document.createElement("div");

        suggestions.setAttribute(`data-${this.NAMESPACE}-suggestions-id`, id);
        suggestions.classList.add(`${this.NAMESPACE}__suggestions`);

        // Render the actual suggestions input.
        this.instances[id].filterWrapper.appendChild(suggestions);

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
        if (!v || !Array.isArray(v)) {
          return;
        }

        const [value, label] = v;
        const option = document.createElement("option");

        option.selected = true;
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
      const config = this.config;

      const endpoint = this.instances[id].target.getAttribute(endpointTag)
        ? this.instances[id].target.getAttribute(endpointTag)
        : this.endpoint;

      if (instance.onBlur && instance.filter) {
        instance.filter.removeEventListener("blur", instance.onBlur);
      }

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

      if (instance.onClick) {
        document.removeEventListener("click", instance.onClick);
      }

      if (instance.onSubmit && instance.form) {
        instance.form.removeEventListener("submit", instance.onSubmit);
      }

      if (instance.filter) {
        this.update(id, {
          onClick: (event) => {
            const { target } = event;

            if (!target) {
              return;
            }

            if (
              target === instance.wrapper ||
              instance.wrapper.contains(target)
            ) {
              if (instance.suggestedValues && instance.suggestedValues.length) {
                this.displaySuggestions(id);
              }

              this.handleCallback("onClick", id, target);
            } else {
              // Prevent collapse for removed autosuggest elements.
              if (
                document.contains(target) &&
                instance.wrapper !== target &&
                !instance.wrapper.contains(target)
              ) {
                this.update(id, {
                  preventCollapse: false,
                });

                // this.instances[id].preventCollapse = false;
              }

              if (!this.instances[id].preventCollapse) {
                this.collapse(id);
              }
            }
          },
          onFilter: (event) => {
            // Prevent a secondary filters that is inherited from other input
            // events.
            const cachedValue = instance.filter.getAttribute(cacheTag);
            if (cachedValue && cachedValue === instance.filter.value) {
              return;
            }

            if (
              this.instances[id].preventFilter
              // this.instances[id].preventUpdate
            ) {
              return;
            }

            // @todo Probably not needed anymore.
            // if (
            //   this.instances[id] &&
            //   this.instances[id].filter &&
            //   !this.instances[id].filter.value
            // ) {
            //   if (
            //     this.instances[id].target &&
            //     !this.instances[id].target.hasAttribute("multiple")
            //   ) {
            //     this.log("empty");
            //   }
            // }

            // @todo should a callback be used here?

            this.handleFilter(
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
                  this.log(
                    `Updating suggestions for ${id}: ${instance.filter.value}`
                  );

                  // this.instances[id].suggestedValues = suggestedValues;
                  this.update(id, {
                    suggestedValues,
                  });
                }

                this.displaySuggestions(id);

                this.handleCallback("onFilter", id, event.target);
              },
              config
            );
          },
          onFocus: (event) => {
            if (!event.target.value) {
              // @todo implement cached ajax.
              // Ignore the endpoint suggestions during the initial focus.
              const suggestedValues = this.filterValues(id, "", []);

              // this.instances[id].suggestedValues = suggestedValues;
              this.update(id, {
                suggestedValues,
              });

              this.displaySuggestions(id);
            }

            this.handleCallback("onFocus", id, event.target);
          },
          onBlur: (event) => {
            const { relatedTarget } = event;

            if (
              relatedTarget &&
              relatedTarget !== instance.wrapper &&
              !instance.wrapper.contains(relatedTarget)
            ) {
              this.collapse(id);
            }

            this.handleCallback("onBlur", id, event.target);
          },
          onKeyDown: (event) => {
            if (this.catchKey(event)) {
              // Prevents the submit event inherited from the filter.
              if (event.keyCode === 13) {
                event.preventDefault();
                // this.instances[id].preventUpdate = true;
              }
            }

            this.handleCallback("onKeyDown", id, event.target);
          },
          onKeyUp: (event) => {
            if (this.catchKey(event) == null) {
              instance.filter.blur();
            }

            if (!this.catchKey(event)) {
              // this.log("Block keyup");
              return;
            }

            if (
              !instance.filter.value.length &&
              instance.selectedValues &&
              instance.selectedValues.length &&
              !instance.target.hasAttribute("multiple")
            ) {
              this.deselect(id);
            }

            // Prevent accidental form submits.
            if (event.keyCode === 13) {
              event.preventDefault();

              if (!instance.filter.value.length) {
                return;
              }

              // this.log(`Handle select from return: ${id}`);

              instance.filter.dispatchEvent(new CustomEvent("change"));

              return this.select(id);
            }

            // Should delay enough to give enough time to filter.
            this.throttle(id, () => {
              const cachedValue = instance.filter.getAttribute(cacheTag);

              if (!cachedValue && instance.filter.value) {
                instance.filter.dispatchEvent(new CustomEvent("change"));
              } else if (cachedValue && cachedValue !== instance.filter.value) {
                instance.filter.dispatchEvent(new CustomEvent("change"));
              }

              instance.filter.setAttribute(cacheTag, instance.filter.value);

              this.handleCallback("onKeyUp", id, event.target);
            });
          },
        });

        document.addEventListener("click", this.instances[id].onClick);

        instance.filter.addEventListener("change", this.instances[id].onFilter);

        instance.filter.addEventListener("focus", this.instances[id].onFocus);

        instance.filter.addEventListener("blur", this.instances[id].onBlur);

        instance.filter.addEventListener(
          "keydown",
          this.instances[id].onKeyDown
        );

        instance.filter.addEventListener("keyup", this.instances[id].onKeyUp);
      }

      // @todo place logic for submits here
      if (instance.form) {
        this.update(id, {
          onSubmit: (event) => {
            // this.log("submit");

            if (this.instances[id] && this.instances[id].preventSubmit) {
              // this.log("prevent submit");
              event.preventDefault();
            }

            this.handleCallback("onSubmit", id, event.target);
          },
        });

        instance.form.addEventListener("submit", () => {
          this.instances[id].onSubmit;
        });
      }
    }

    /**
     * Selects from the current suggestions.
     *
     * @param {String} id Selects from the subscribed id.
     * @param {Number} index Select the defined index or the first.
     * @param {String} initialValue Reference as value for the selected index.
     */
    select(id, index, initialValue) {
      if (
        this.instances[id] &&
        Array.isArray(this.instances[id].suggestedValues)
      ) {
        const selectedValue = this.instances[id].suggestedValues[index]
          ? this.instances[id].suggestedValues[index]
          : this.instances[id].suggestedValues[0];

        if (this.instances[id].target.hasAttribute("multiple")) {
          // this.instances[id].preventFilter = true;

          // this.instances[id].filter.value = "";

          // this.instances[id].preventFilter = false;

          if (!Array.isArray(this.instances[id].selectedValues)) {
            // this.instances[id].selectedValues = [];
            this.update(id, {
              selectedValues: [],
            });
          }

          if (!this.instances[id].selectedValues.includes(selectedValue)) {
            this.update(id, {
              selectedValues: [selectedValue].concat(
                this.instances[id].selectedValues
              ),
            });
            // this.instances[id].selectedValues = [selectedValue].concat(
            //   this.instances[id].selectedValues
            // );
          } else {
            this.update(id, {
              selectedValues: this.instances[id].selectedValues,
            });
            // this.instances[id].selectedValues = this.instances[id].selectedValues;
          }
        } else {
          this.update(id, {
            selectedValues: [selectedValue],
          });
          // this.instances[id].selectedValues = [selectedValue];
        }

        this.handleCallback("onSelect", id, this.instances[id].target, {
          selectedValue,
        });
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
      this.displaySuggestions(id, initialValue);
    }

    /**
     * Removes the defined value from the selected values for the current instance.
     *
     * @param {String} id Deselects from the subscribed id.
     * @param {Array} selection The selection to remove.
     */
    deselect(id, selection) {
      if (!id || !this.instances[id]) {
        this.error(`Unable to deselect for non-existing id: ${id}`);
      }

      if (!this.instances[id] || !this.instances[id].selectedValues.length) {
        return;
      }

      // Deselects all values for the defined target.
      if (!Array.isArray(selection)) {
        this.log(`Removing all selections`);

        return this.instances[id].selectedValues.forEach((selectedValue) =>
          this.deselect(id, selectedValue)
        );
      }

      const commit = this.instances[id].selectedValues.filter(
        (selectedValue) => selectedValue[0] !== selection[0]
      );

      this.log(`Removed selection: ${selection[1]} => ${selection[0]}`);

      // this.instances[id].selectedValues = commit;
      this.update(id, {
        selectedValues: commit,
      });

      // Update the instance target.
      this.updateTarget(this.instances[id].target);

      if (this.instances[id].target.hasAttribute("multiple")) {
        // Display the selected suggestions
        this.displaySelections(id, selection[0]);
      } else {
        this.displaySelection(id);
      }

      // Filter out the selected suggestion.
      this.displaySuggestions(id);

      // Ensures the the user is not disturbed while removing options.
      this.collapse(id);

      this.handleCallback("onDeselect", id, this.instances[id].target, {
        removedValue: selection,
      });
    }

    validateCollapse(id) {
      if (!id || !this.instances[id]) {
        this.error(`Unable to validate for non-existing id: ${id}`);

        return;
      }

      const leftover = [];

      if (!this.instances[id].suggestedValues) {
        return;
      }

      const list = this.instances[id].suggestedValues.filter((v) => {
        if (!v) {
          return null;
        }

        const [value] = v;

        if (!this.instances[id] || !this.instances[id].selectedValues) {
          return;
        }

        return (
          this.instances[id].selectedValues.filter((vv) => {
            return vv[0].toLowerCase() === value.toLowerCase();
          }).length === 0
        );
      });

      if (list.length) {
        // this.instances[id].preventCollapse = true;
        this.update(id, {
          preventCollapse: true,
        });
      } else {
        // this.instances[id].preventCollapse = false;
        this.update(id, {
          preventCollapse: false,
        });
      }

      // Should compare the suggested with the selected values.
      // Should mark the preventCollapse flag in order to fix hiding content.
    }

    /**
     * Defines the current element as expanded.
     *
     * @param {String} id Expands the selected element;
     */
    expand(id) {
      if (!id || !this.instances[id]) {
        this.error(`Unable to expand for non-existing id: ${id}`);
        return;
      }

      if (
        !this.instances[id].suggestedValues ||
        !this.instances[id].suggestedValues.length
      ) {
        return;
      }

      if (this.instances[id].wrapper) {
        this.instances[id].wrapper.removeAttribute("aria-collapsed");
      }
    }

    /**
     * Defines the current element as collapsed.
     *
     * @param {String} id Collapses the selected element;
     */
    collapse(id) {
      if (!id || !this.instances[id]) {
        this.error(`Unable to collapse for non-existing id: ${id}`);
      }

      if (this.instances[id].wrapper) {
        this.instances[id].wrapper.setAttribute("aria-collapsed", true);
      }
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
        this.error(`Unable to throttle non existing instance: ${id}`);
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
        this.error(`Unable to filter non exsiting instance: ${id}`);
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
    handleFilter(id, endpoint, query, handler, config) {
      const instance = this;

      if (this.instances[id].preventFilter) {
        return;
      }

      // Skip the undefined endpoint for this request.
      if (!endpoint) {
        return handler([]);
      }

      // this.instances[id].preventFilter = true;
      this.update(id, {
        preventFilter: true,
      });

      if (!query || query.length < (this.config.minQueryLength || 2)) {
        // this.instances[id].preventFilter = false;
        this.update(id, {
          preventFilter: false,
        });

        return handler([]);
      }

      const request = new XMLHttpRequest();

      const c = config || {};
      if (!c.parameters) {
        c.parameters = {};
      }

      let method = c.method && c.method === "POST" ? "POST" : "GET";

      // Include the actual filter within the request.
      const commit = {};
      const filterName = this.instances[id].filter.getAttribute("name") || id;
      commit[filterName] = this.instances[id].filter.value;

      if (Object.values(commit).length) {
        c.parameters = Object.assign(c.parameters, commit);
      }

      if (this.instances[id].target) {
        request.open(
          method,
          method === "POST"
            ? endpoint
            : `${endpoint}${this.serialize(c.parameters || {})}`,
          true
        );
      }

      // Define the required header for the actual request.
      if (method === "POST") {
        request.setRequestHeader(
          "Content-Type",
          c.contentType
            ? c.contentType
            : "application/x-www-form-urlencoded; charset=UTF-8"
        );
      }

      request.onload = function () {
        if (this.status >= 200 && this.status < 400) {
          let response;

          try {
            response = JSON.parse(this.response);
          } catch (error) {
            instance.error(`Unable to parse response from: ${query}`);
          }

          if (response) {
            if (c.transform) {
              instance.log(`Transforming endpoint output with custom handler.`);

              let transformedResponse;
              try {
                transformedResponse = c.transform(response);
              } catch (error) {
                instance.error(`Unable to transform response: ${error}`);
              }

              if (Array.isArray(transformedResponse)) {
                return handler(transformedResponse);
              } else {
                instance.error(
                  "Ignoring custom transform handler, it does return an Array"
                );

                return handler([response]);
              }
            } else {
              return handler([response]);
            }
          } else {
            handler([]);
          }
        } else {
          instance.error(`Unable to use endpoint: ${this.statusText}`);

          instance.handleCallback("onEndpointException", id, this);
        }
      };

      request.onloadstart = () => {
        if (this.instances[id].wrapper) {
          this.instances[id].wrapper.setAttribute("aria-busy", true);
        }
      };

      request.onerror = function () {
        instance.error(`Unable to use endpoint: ${this.statusText}`);
      };

      request.onloadend = () => {
        setTimeout(() => {
          // this.instances[id].preventFilter = false;
          this.update(id, {
            preventFilter: false,
          });

          if (this.instances[id].wrapper) {
            this.instances[id].wrapper.removeAttribute("aria-busy");
          }
        }, 1);
      };

      // @todo should check parameters with post method.
      request.send(
        c.config && c.config.method === "POST" && c.config.parameters
          ? c.config.parameters
          : null
      );
    }

    /**
     * Helper function to initiate the optional callback
     *
     * @param {String} name Name of the callback handler to initiate.
     * @param {String} id Use the properties of the instance within the handler.
     * @param {HTMLElement} context The context element where the initial handler
     * is called from.
     */
    handleCallback(name, id, context, props) {
      if (!this.callback || !this.instances[id] || !this.callback[name]) {
        return;
      }

      if (typeof this.callback[name] !== "function") {
        this.log(
          `Warning, unable to use '${name}' since it is not a valid callback handler.`
        );

        return;
      }

      // Handle the actual callback
      this.callback[name]({
        id: id,
        instance: this.instances[id],
        selections: this.instances[id].selectedValues,
        suggestions: this.instances[id].suggestedValues,
        query: this.instances[id].filter.value,
        context,
        props,
      });
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

    /**
     * Transforms the given Object to a valid query string.
     *
     * @param {Object} commit The Object to convert.
     */
    serialize(commit) {
      let result = [];
      Object.keys(commit).forEach((c) => {
        if (commit.hasOwnProperty(c)) {
          result.push(
            encodeURIComponent(c) + "=" + encodeURIComponent(commit[c])
          );
        }
      });

      return result.length ? `?${result.join("&")}` : "";
    }

    /**
     * Console.log alias to ensure browser support.
     */
    log(...args) {
      if (this.silent) {
        return;
      }

      if (!window.console || !console.log) {
        return;
      }

      return console.log(...args);
    }

    /**
     * Console.error alias to ensure browser support.
     */
    error(...args) {
      if (!window.console || !this.error) {
        return;
      }

      return console.error(...args);
    }
  }

  if (!root.SelectAutosuggest) {
    root.SelectAutosuggest = SelectAutosuggest;
  }
})(window);
