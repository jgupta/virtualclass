/*
 * Create the Editor, handle all text operation on editor, all OT work are performing on this file
 *
 * Copyright 2015 Vidyamantra EduSystem Pvt Ltd.
 * with code from ot.js (Copyright 2012-2013 Tim Baumann)
 *
 * Version 0.0.1
 */

const Vceditor = (function (window) {
  var vceditor = vceditor || {};
  vceditor.utils = window.utils;


  var vceditor = vceditor || {};

  vceditor.Span = window.Span;
  vceditor.TextOp = window.TextOp;
  vceditor.TextOperation = window.TextOperation;

  // if (typeof module === 'object') {
  //     module.exports = vceditor.TextOperation;
  // }

  // TODO: Rewrite this (probably using a splay tree) to be efficient.  Right now it's based on a linked list
  // so all operations are O(n), where n is the number of spans in the list.


  // T2
  vceditor.AnnotationList = window.AnnotationList;

  vceditor.Cursor = window.Cursor;
  vceditor.RichTextToolbar = window.RichTextToolbar;
  vceditor.WrappedOperation = window.WrappedOperation;
  vceditor.UndoManager = window.UndoManager;

  // invoking ot.js client

  vceditor.Client = window.Client;
  Client = vceditor.Client;

  vceditor.EditorClient = window.EditorClient;

  vceditor.utils.makeEventEmitter(vceditor.EditorClient, ['synced']);


  vceditor.AttributeConstants = window.AttributeConstants;

  // vceditor.sentinelConstants = window.sentinelConstants;

  // T4
  vceditor.sentinelConstants = {
    // A special character we insert at the beginning of lines so we can attach attributes to it to represent
    // "line attributes."  E000 is from the unicode "private use" range.
    LINE_SENTINEL_CHARACTER: '\uE000',

    // A special character used to represent any "entity" inserted into the document (e.g. an image).
    ENTITY_SENTINEL_CHARACTER: '\uE001',
  };


  vceditor.EntityManager = (function () {
    const { utils } = vceditor;

    function EntityManager() {
      this.entities_ = {};

      const attrs = ['src', 'alt', 'width', 'height', 'style', 'class'];
      this.register('img', {
        render(info) {
          utils.assert(info.src, "image entity should have 'src'!");
          const attrs = ['src', 'alt', 'width', 'height', 'style', 'class'];
          let html = '<img ';
          for (let i = 0; i < attrs.length; i++) {
            const attr = attrs[i];
            if (attr in info) {
              html += ` ${attr}="${info[attr]}"`;
            }
          }
          html += '>';
          return html;
        },
        fromElement(element) {
          const info = {};
          for (let i = 0; i < attrs.length; i++) {
            const attr = attrs[i];
            if (element.hasAttribute(attr)) {
              info[attr] = element.getAttribute(attr);
            }
          }
          return info;
        },
      });
    }

    EntityManager.prototype.register = function (type, options) {
      vceditor.utils.assert(options.render, "Entity options should include a 'render' function!");
      vceditor.utils.assert(options.fromElement, "Entity options should include a 'fromElement' function!");
      this.entities_[type] = options;
    };

    EntityManager.prototype.renderToElement = function (entity, entityHandle) {
      return this.tryRenderToElement_(entity, 'render', entityHandle);
    };

    EntityManager.prototype.exportToElement = function (entity) {
      // Turns out 'export' is a reserved keyword, so 'getHtml' is preferable.
      const elt = this.tryRenderToElement_(entity, 'export')
        || this.tryRenderToElement_(entity, 'getHtml')
        || this.tryRenderToElement_(entity, 'render');
      elt.setAttribute('data-vceditor-entity', entity.type);
      return elt;
    };

    /* Updates a DOM element to reflect the given entity.
     If the entity doesn't support the update method, it is fully
     re-rendered.
     */
    EntityManager.prototype.updateElement = function (entity, element) {
      const { type } = entity;
      const { info } = entity;
      if (this.entities_[type] && typeof (this.entities_[type].update) !== 'undefined') {
        this.entities_[type].update(info, element);
      }
    };

    EntityManager.prototype.fromElement = function (element) {
      let type = element.getAttribute('data-vceditor-entity');

      // HACK.  This should be configurable through entity registration.
      if (!type) type = element.nodeName.toLowerCase();

      if (type && this.entities_[type]) {
        const info = this.entities_[type].fromElement(element);
        return new vceditor.Entity(type, info);
      }
    };

    EntityManager.prototype.tryRenderToElement_ = function (entity, renderFn, entityHandle) {
      const { type } = entity;
      const { info } = entity;
      if (this.entities_[type] && this.entities_[type][renderFn]) {
        const windowDocument = vceditor.document || (window && window.document);
        const res = this.entities_[type][renderFn](info, entityHandle, windowDocument);
        if (res) {
          if (typeof res === 'string') {
            const div = (vceditor.document || document).createElement('div');
            div.innerHTML = res;
            return div.childNodes[0];
          } if (typeof res === 'object') {
            vceditor.utils.assert(typeof res.nodeType !== 'undefined', `Error rendering ${type} entity.  render() function`
              + ' must return an html string or a DOM element.');
            return res;
          }
        }
      }
    };

    EntityManager.prototype.entitySupportsUpdate = function (entityType) {
      return this.entities_[entityType] && this.entities_[entityType].update;
    };

    return EntityManager;
  }());

  var vceditor = vceditor || {};

  vceditor.Entity = window.entity;

  /**
   * Object to represent an Entity.
   */
  // T5
  vceditor.Entity = (function () {
    const ATTR = vceditor.AttributeConstants;
    const SENTINEL = ATTR.ENTITY_SENTINEL;
    const PREFIX = `${SENTINEL}_`;

    function Entity(type, info) {
      // Allow calling without new.
      if (!(this instanceof Entity)) {
        return new Entity(type, info);
      }

      this.type = type;
      this.info = info || {};
    }

    Entity.prototype.toAttributes = function () {
      const attrs = {};
      attrs[SENTINEL] = this.type;

      for (const attr in this.info) {
        attrs[PREFIX + attr] = this.info[attr];
      }

      return attrs;
    };

    Entity.fromAttributes = function (attributes) {
      const type = attributes[SENTINEL];
      const info = {};
      for (const attr in attributes) {
        if (attr.indexOf(PREFIX) === 0) {
          info[attr.substr(PREFIX.length)] = attributes[attr];
        }
      }

      return new Entity(type, info);
    };

    return Entity;
  }());

  vceditor.RichTextCodeMirror = (function () {
    const { AnnotationList } = vceditor;
    const { Span } = vceditor;
    const { utils } = vceditor;
    const ATTR = vceditor.AttributeConstants;

    const RichTextClassPrefixDefault = 'cmrt-';
    const RichTextOriginPrefix = 'cmrt-';

    // These attributes will have styles generated dynamically in the page.
    const DynamicStyleAttributes = {
      c: 'color',
      bc: 'background-color',
      fs: 'font-size',
      li(indent) {
        return `padding-left: ${indent * 40}px`;
      },
    };

    // A cache of dynamically-created styles so we can re-use them.
    const StyleCache_ = {};

    function RichTextCodeMirror(codeMirror, entityManager, options) {
      this.codeMirror = codeMirror;
      this.options_ = options || {};
      this.entityManager_ = entityManager;
      this.currentAttributes_ = null;

      const self = this;
      this.annotationList_ = new AnnotationList(
        ((oldNodes, newNodes) => {
          self.onAnnotationsChanged_(oldNodes, newNodes);
        }),
      );

      // Ensure annotationList is in sync with any existing codemirror contents.
      this.initAnnotationList_();

      bind(this, 'onCodeMirrorBeforeChange_');
      bind(this, 'onCodeMirrorChange_');
      bind(this, 'onCursorActivity_');

      if (/^4\./.test(CodeMirror.version)) {
        this.codeMirror.on('changes', this.onCodeMirrorChange_);
      } else {
        this.codeMirror.on('change', this.onCodeMirrorChange_);
      }
      this.codeMirror.on('beforeChange', this.onCodeMirrorBeforeChange_);
      this.codeMirror.on('cursorActivity', this.onCursorActivity_);

      this.changeId_ = 0;
      this.outstandingChanges_ = {};
      this.dirtyLines_ = [];
    }

    utils.makeEventEmitter(RichTextCodeMirror, ['change', 'attributesChange', 'newLine']);


    const LineSentinelCharacter = vceditor.sentinelConstants.LINE_SENTINEL_CHARACTER;
    const EntitySentinelCharacter = vceditor.sentinelConstants.ENTITY_SENTINEL_CHARACTER;

    RichTextCodeMirror.prototype.detach = function () {
      this.codeMirror.off('beforeChange', this.onCodeMirrorBeforeChange_);
      this.codeMirror.off('change', this.onCodeMirrorChange_);
      this.codeMirror.off('changes', this.onCodeMirrorChange_);
      this.codeMirror.off('cursorActivity', this.onCursorActivity_);
      this.clearAnnotations_();
    };

    RichTextCodeMirror.prototype.toggleAttribute = function (attribute, value) {
      const trueValue = value || true;
      if (this.emptySelection_()) {
        const attrs = this.getCurrentAttributes_();
        if (attrs[attribute] === trueValue) {
          delete attrs[attribute];
        } else {
          attrs[attribute] = trueValue;
        }
        this.currentAttributes_ = attrs;
      } else {
        const attributes = this.getCurrentAttributes_();
        const newValue = (attributes[attribute] !== trueValue) ? trueValue : false;
        this.setAttribute(attribute, newValue);
      }
    };

    RichTextCodeMirror.prototype.setAttribute = function (attribute, value) {
      const cm = this.codeMirror;
      if (this.emptySelection_()) {
        const attrs = this.getCurrentAttributes_();
        if (value === false) {
          delete attrs[attribute];
        } else {
          attrs[attribute] = value;
        }
        this.currentAttributes_ = attrs;
      } else {
        this.updateTextAttributes(cm.indexFromPos(cm.getCursor('start')), cm.indexFromPos(cm.getCursor('end')),
          (attributes) => {
            if (value === false) {
              delete attributes[attribute];
            } else {
              attributes[attribute] = value;
            }
          });

        this.updateCurrentAttributes_();
      }
    };

    RichTextCodeMirror.prototype.updateTextAttributes = function (start, end, updateFn, origin, doLineAttributes) {
      const newChanges = [];
      let pos = start; const
        self = this;
      this.annotationList_.updateSpan(new Span(start, end - start), (annotation, length) => {
        const attributes = {};
        for (const attr in annotation.attributes) {
          attributes[attr] = annotation.attributes[attr];
        }

        // Don't modify if this is a line sentinel.
        if (!attributes[ATTR.LINE_SENTINEL] || doLineAttributes) updateFn(attributes);

        // changedAttributes will be the attributes we changed, with their new values.
        // changedAttributesInverse will be the attributes we changed, with their old values.
        const changedAttributes = {}; const
          changedAttributesInverse = {};
        self.computeChangedAttributes_(annotation.attributes, attributes, changedAttributes, changedAttributesInverse);
        if (!emptyAttributes(changedAttributes)) {
          newChanges.push({
            start: pos,
            end: pos + length,
            attributes: changedAttributes,
            attributesInverse: changedAttributesInverse,
            origin,
          });
        }

        pos += length;
        return new RichTextAnnotation(attributes);
      });

      if (newChanges.length > 0) {
        this.trigger('attributesChange', this, newChanges);
      }
    };

    RichTextCodeMirror.prototype.computeChangedAttributes_ = function (oldAttrs, newAttrs, changed, inverseChanged) {
      const attrs = {}; let
        attr;
      for (attr in oldAttrs) {
        attrs[attr] = true;
      }
      for (attr in newAttrs) {
        attrs[attr] = true;
      }

      for (attr in attrs) {
        if (!(attr in newAttrs)) {
          // it was removed.
          changed[attr] = false;
          inverseChanged[attr] = oldAttrs[attr];
        } else if (!(attr in oldAttrs)) {
          // it was added.
          changed[attr] = newAttrs[attr];
          inverseChanged[attr] = false;
        } else if (oldAttrs[attr] !== newAttrs[attr]) {
          // it was changed.
          changed[attr] = newAttrs[attr];
          inverseChanged[attr] = oldAttrs[attr];
        }
      }
    };

    RichTextCodeMirror.prototype.toggleLineAttribute = function (attribute, value) {
      const currentAttributes = this.getCurrentLineAttributes_();
      let newValue;
      if (!(attribute in currentAttributes) || currentAttributes[attribute] !== value) {
        newValue = value;
      } else {
        newValue = false;
      }
      this.setLineAttribute(attribute, newValue);
    };

    RichTextCodeMirror.prototype.setLineAttribute = function (attribute, value) {
      this.updateLineAttributesForSelection((attributes) => {
        if (value === false) {
          delete attributes[attribute];
        } else {
          attributes[attribute] = value;
        }
      });
    };

    RichTextCodeMirror.prototype.updateLineAttributesForSelection = function (updateFn) {
      const cm = this.codeMirror;
      const start = cm.getCursor('start'); const
        end = cm.getCursor('end');
      const startLine = start.line; let
        endLine = end.line;
      const endLineText = cm.getLine(endLine);
      const endsAtBeginningOfLine = this.areLineSentinelCharacters_(endLineText.substr(0, end.ch));
      if (endLine > startLine && endsAtBeginningOfLine) {
        // If the selection ends at the beginning of a line, don't include that line.
        endLine--;
      }

      this.updateLineAttributes(startLine, endLine, updateFn);
    };

    RichTextCodeMirror.prototype.updateLineAttributes = function (startLine, endLine, updateFn) {
      // TODO: Batch this into a single operation somehow.
      for (let line = startLine; line <= endLine; line++) {
        const text = this.codeMirror.getLine(line);
        const lineStartIndex = this.codeMirror.indexFromPos({ line, ch: 0 });
        // Create line sentinel character if necessary.
        if (text[0] !== LineSentinelCharacter) {
          const attributes = {};
          attributes[ATTR.LINE_SENTINEL] = true;
          updateFn(attributes);
          this.insertText(lineStartIndex, LineSentinelCharacter, attributes);
        } else {
          this.updateTextAttributes(lineStartIndex, lineStartIndex + 1, updateFn, /* origin= */null, /* doLineAttributes= */true);
        }
      }
    };

    RichTextCodeMirror.prototype.replaceText = function (start, end, text, attributes, origin) {
      this.changeId_++;
      const newOrigin = RichTextOriginPrefix + this.changeId_;
      this.outstandingChanges_[newOrigin] = { origOrigin: origin, attributes };

      const cm = this.codeMirror;
      const from = cm.posFromIndex(start);
      const to = typeof end === 'number' ? cm.posFromIndex(end) : null;
      cm.replaceRange(text, from, to, newOrigin);
    };

    RichTextCodeMirror.prototype.insertText = function (index, text, attributes, origin) {
      const cm = this.codeMirror;
      const cursor = cm.getCursor();
      const resetCursor = origin == 'RTCMADAPTER' && !cm.somethingSelected() && index == cm.indexFromPos(cursor);
      this.replaceText(index, null, text, attributes, origin);
      if (resetCursor) cm.setCursor(cursor);
    };

    RichTextCodeMirror.prototype.removeText = function (start, end, origin) {
      const cm = this.codeMirror;
      cm.replaceRange('', cm.posFromIndex(start), cm.posFromIndex(end), origin);
    };

    RichTextCodeMirror.prototype.insertEntityAtCursor = function (type, info, origin) {
      const cm = this.codeMirror;
      const index = cm.indexFromPos(cm.getCursor('head'));
      this.insertEntityAt(index, type, info, origin);
    };

    RichTextCodeMirror.prototype.insertEntityAt = function (index, type, info, origin) {
      const cm = this.codeMirror;
      this.insertEntity_(index, new vceditor.Entity(type, info), origin);
    };

    RichTextCodeMirror.prototype.insertEntity_ = function (index, entity, origin) {
      this.replaceText(index, null, EntitySentinelCharacter, entity.toAttributes(), origin);
    };

    RichTextCodeMirror.prototype.getAttributeSpans = function (start, end) {
      const spans = [];
      const annotatedSpans = this.annotationList_.getAnnotatedSpansForSpan(new Span(start, end - start));
      for (let i = 0; i < annotatedSpans.length; i++) {
        spans.push({ length: annotatedSpans[i].length, attributes: annotatedSpans[i].annotation.attributes });
      }

      return spans;
    };

    RichTextCodeMirror.prototype.end = function () {
      const lastLine = this.codeMirror.lineCount() - 1;
      return this.codeMirror.indexFromPos({ line: lastLine, ch: this.codeMirror.getLine(lastLine).length });
    };

    RichTextCodeMirror.prototype.getRange = function (start, end) {
      const from = this.codeMirror.posFromIndex(start); const
        to = this.codeMirror.posFromIndex(end);
      return this.codeMirror.getRange(from, to);
    };

    RichTextCodeMirror.prototype.initAnnotationList_ = function () {
      // Insert empty annotation span for existing content.
      const end = this.end();
      if (end !== 0) {
        this.annotationList_.insertAnnotatedSpan(new Span(0, end), new RichTextAnnotation());
      }
    };

    /**
     * Updates the nodes of an Annotation.
     * @param {Array.<OldAnnotatedSpan>} oldNodes The list of nodes to replace.
     * @param {Array.<NewAnnotatedSpan>} newNodes The new list of nodes.
     */
    RichTextCodeMirror.prototype.onAnnotationsChanged_ = function (oldNodes, newNodes) {
      let marker;

      const linesToReMark = {};

      // Update any entities in-place that we can.  This will remove them from the oldNodes/newNodes lists
      // so we don't remove and recreate them below.
      this.tryToUpdateEntitiesInPlace(oldNodes, newNodes);

      for (var i = 0; i < oldNodes.length; i++) {
        const { attributes } = oldNodes[i].annotation;
        if (ATTR.LINE_SENTINEL in attributes) {
          linesToReMark[this.codeMirror.posFromIndex(oldNodes[i].pos).line] = true;
        }
        marker = oldNodes[i].getAttachedObject();
        if (marker) {
          marker.clear();
        }
      }

      for (i = 0; i < newNodes.length; i++) {
        const { annotation } = newNodes[i];
        const forLine = (ATTR.LINE_SENTINEL in annotation.attributes);
        const entity = (ATTR.ENTITY_SENTINEL in annotation.attributes);

        const from = this.codeMirror.posFromIndex(newNodes[i].pos);
        if (forLine) {
          linesToReMark[from.line] = true;
        } else if (entity) {
          this.markEntity_(newNodes[i]);
        } else {
          const className = this.getClassNameForAttributes_(annotation.attributes);
          if (className !== '') {
            const to = this.codeMirror.posFromIndex(newNodes[i].pos + newNodes[i].length);
            marker = this.codeMirror.markText(from, to, { className });
            newNodes[i].attachObject(marker);
          }
        }
      }

      for (const line in linesToReMark) {
        this.dirtyLines_.push(this.codeMirror.getLineHandle(Number(line)));
        this.queueLineMarking_();
      }
    };

    RichTextCodeMirror.prototype.tryToUpdateEntitiesInPlace = function (oldNodes, newNodes) {
      // Loop over nodes in reverse order so we can easily splice them out as necessary.
      let oldNodesLen = oldNodes.length;
      while (oldNodesLen--) {
        const oldNode = oldNodes[oldNodesLen];
        let newNodesLen = newNodes.length;
        while (newNodesLen--) {
          const newNode = newNodes[newNodesLen];
          if (oldNode.pos == newNode.pos
            && oldNode.annotation.attributes.ent
            && oldNode.annotation.attributes.ent == newNode.annotation.attributes.ent) {
            const entityType = newNode.annotation.attributes.ent;
            if (this.entityManager_.entitySupportsUpdate(entityType)) {
              // Update it in place and remove the change from oldNodes / newNodes so we don't process it below.
              oldNodes.splice(oldNodesLen, 1);
              newNodes.splice(newNodesLen, 1);
              const marker = oldNode.getAttachedObject();
              marker.update(newNode.annotation.attributes);
              newNode.attachObject(marker);
            }
          }
        }
      }
    };

    RichTextCodeMirror.prototype.queueLineMarking_ = function () {
      if (this.lineMarkTimeout_ != null) return;
      const self = this;

      this.lineMarkTimeout_ = setTimeout(() => {
        self.lineMarkTimeout_ = null;
        const dirtyLineNumbers = [];
        for (var i = 0; i < self.dirtyLines_.length; i++) {
          const lineNum = self.codeMirror.getLineNumber(self.dirtyLines_[i]);
          dirtyLineNumbers.push(Number(lineNum));
        }
        self.dirtyLines_ = [];

        dirtyLineNumbers.sort((a, b) => a - b);
        let lastLineMarked = -1;
        for (i = 0; i < dirtyLineNumbers.length; i++) {
          const lineNumber = dirtyLineNumbers[i];
          if (lineNumber > lastLineMarked) {
            lastLineMarked = self.markLineSentinelCharactersForChangedLines_(lineNumber, lineNumber);
          }
        }
      }, 0);
    };

    RichTextCodeMirror.prototype.addStyleWithCSS_ = function (css) {
      const head = document.getElementsByTagName('head')[0];
      const style = document.createElement('style');

      style.type = 'text/css';
      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(document.createTextNode(css));
      }

      head.appendChild(style);
    };

    RichTextCodeMirror.prototype.getClassNameForAttributes_ = function (attributes) {
      let globalClassName = '';
      for (const attr in attributes) {
        let val = attributes[attr];
        if (attr === ATTR.LINE_SENTINEL) {
          vceditor.utils.assert(val === true, 'LINE_SENTINEL attribute should be true if it exists.');
        } else {
          let className = (this.options_.cssPrefix || RichTextClassPrefixDefault) + attr;
          if (val !== true) {
            // Append "px" to font size if it's missing.
            // Probably could be removed now as parseHtml automatically adds px when required
            if (attr === ATTR.FONT_SIZE && typeof val !== 'string') {
              val += 'px';
            }

            const classVal = val.toString().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
            className += `-${classVal}`;
            if (DynamicStyleAttributes[attr]) {
              if (!StyleCache_[attr]) StyleCache_[attr] = {};
              if (!StyleCache_[attr][classVal]) {
                StyleCache_[attr][classVal] = true;
                const dynStyle = DynamicStyleAttributes[attr];
                const css = (typeof dynStyle === 'function')
                  ? dynStyle(val)
                  : `${dynStyle}: ${val}`;

                const selector = (attr == ATTR.LINE_INDENT)
                  ? `pre.${className}`
                  : `.${className}`;

                this.addStyleWithCSS_(`${selector} { ${css} }`);
              }
            }
          }
          globalClassName = `${globalClassName} ${className}`;
        }
      }
      return globalClassName;
    };

    RichTextCodeMirror.prototype.markEntity_ = function (annotationNode) {
      const { attributes } = annotationNode.annotation;
      const entity = vceditor.Entity.fromAttributes(attributes);
      const cm = this.codeMirror;
      const self = this;

      const markers = [];
      for (let i = 0; i < annotationNode.length; i++) {
        const from = cm.posFromIndex(annotationNode.pos + i);
        const to = cm.posFromIndex(annotationNode.pos + i + 1);

        const options = {
          collapsed: true, atomic: true, inclusiveLeft: false, inclusiveRight: false,
        };

        const entityHandle = this.createEntityHandle_(entity, annotationNode.pos);

        const element = this.entityManager_.renderToElement(entity, entityHandle);
        if (element) {
          options.replacedWith = element;
        }
        const marker = cm.markText(from, to, options);
        markers.push(marker);
        entityHandle.setMarker(marker);
      }

      annotationNode.attachObject({
        clear() {
          for (let i = 0; i < markers.length; i++) {
            markers[i].clear();
          }
        },

        /**
         * Updates the attributes of all the AnnotationNode entities.
         * @param {Object.<string, string>} info The full list of new
         *     attributes to apply.
         */
        update(info) {
          const entity = vceditor.Entity.fromAttributes(info);
          for (let i = 0; i < markers.length; i++) {
            self.entityManager_.updateElement(entity, markers[i].replacedWith);
          }
        },
      });

      // This probably shouldn't be necessary.  There must be a lurking CodeMirror bug.
      this.queueRefresh_();
    };

    RichTextCodeMirror.prototype.queueRefresh_ = function () {
      const self = this;
      if (!this.refreshTimer_) {
        this.refreshTimer_ = setTimeout(() => {
          self.codeMirror.refresh();
          self.refreshTimer_ = null;
        }, 0);
      }
    };

    RichTextCodeMirror.prototype.createEntityHandle_ = function (entity, location) {
      let marker = null;
      const self = this;

      function find() {
        if (marker) {
          const where = marker.find();
          return where ? self.codeMirror.indexFromPos(where.from) : null;
        }
        return location;
      }

      function remove() {
        const at = find();
        if (at != null) {
          self.codeMirror.focus();
          self.removeText(at, at + 1);
        }
      }

      /**
       * Updates the attributes of an Entity.  Will call .update() if the entity supports it,
       * else it'll just remove / re-create the entity.
       * @param {Object.<string, string>} info The full list of new
       *     attributes to apply.
       */
      function replace(info) {
        const ATTR = vceditor.AttributeConstants;
        const SENTINEL = ATTR.ENTITY_SENTINEL;
        const PREFIX = `${SENTINEL}_`;

        const at = find();

        self.updateTextAttributes(at, at + 1, (attrs) => {
          for (const member in attrs) {
            delete attrs[member];
          }
          attrs[SENTINEL] = entity.type;

          for (const attr in info) {
            attrs[PREFIX + attr] = info[attr];
          }
        });
      }

      function setMarker(m) {
        marker = m;
      }

      return {
        find,
        remove,
        replace,
        setMarker,
      };
    };

    RichTextCodeMirror.prototype.lineClassRemover_ = function (lineNum) {
      const cm = this.codeMirror;
      const lineHandle = cm.getLineHandle(lineNum);
      return {
        clear() {
          // HACK to remove all classes (since CodeMirror treats this as a regex internally).
          cm.removeLineClass(lineHandle, 'text', '.*');
        },
      };
    };

    RichTextCodeMirror.prototype.emptySelection_ = function () {
      const start = this.codeMirror.getCursor('start'); const
        end = this.codeMirror.getCursor('end');
      return (start.line === end.line && start.ch === end.ch);
    };

    RichTextCodeMirror.prototype.onCodeMirrorBeforeChange_ = function (cm, change) {
      // Remove LineSentinelCharacters from incoming input (e.g copy/pasting)
      if (change.origin === '+input' || change.origin === 'paste') {
        const newText = [];
        for (let i = 0; i < change.text.length; i++) {
          let t = change.text[i];
          t = t.replace(new RegExp(`[${LineSentinelCharacter}${EntitySentinelCharacter}]`, 'g'), '');
          newText.push(t);
        }
        change.update(change.from, change.to, newText);
      }
    };

    function cmpPos(a, b) {
      return (a.line - b.line) || (a.ch - b.ch);
    }

    function posEq(a, b) {
      return cmpPos(a, b) === 0;
    }

    function posLe(a, b) {
      return cmpPos(a, b) <= 0;
    }

    function last(arr) {
      return arr[arr.length - 1];
    }

    function sumLengths(strArr) {
      if (strArr.length === 0) {
        return 0;
      }
      let sum = 0;
      for (let i = 0; i < strArr.length; i++) {
        sum += strArr[i].length;
      }
      return sum + strArr.length - 1;
    }

    RichTextCodeMirror.prototype.onCodeMirrorChange_ = function (cm, cmChanges) {
      // Handle single change objects and linked lists of change objects.
      if (typeof cmChanges.from === 'object') {
        const changeArray = [];
        while (cmChanges) {
          changeArray.push(cmChanges);
          cmChanges = cmChanges.next;
        }
        cmChanges = changeArray;
      }

      const changes = this.convertCoordinateSystemForChanges_(cmChanges);
      const newChanges = [];

      for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        const { start } = change;
        const { end } = change;
        const { text } = change;
        const { removed } = change;
        let { origin } = change;

        // When text with multiple sets of attributes on it is removed, we need to split it into separate remove changes.
        if (removed.length > 0) {
          const oldAnnotationSpans = this.annotationList_.getAnnotatedSpansForSpan(new Span(start, removed.length));
          let removedPos = 0;
          for (let j = 0; j < oldAnnotationSpans.length; j++) {
            const span = oldAnnotationSpans[j];
            newChanges.push({
              start,
              end: start + span.length,
              removedAttributes: span.annotation.attributes,
              removed: removed.substr(removedPos, span.length),
              attributes: {},
              text: '',
              origin: change.origin,
            });
            removedPos += span.length;
          }

          this.annotationList_.removeSpan(new Span(start, removed.length));
        }

        if (text.length > 0) {
          var attributes;
          // TODO: Handle 'paste' differently?
          if (change.origin === '+input' || change.origin === 'paste') {
            attributes = this.currentAttributes_ || {};
          } else if (origin in this.outstandingChanges_) {
            attributes = this.outstandingChanges_[origin].attributes;
            origin = this.outstandingChanges_[origin].origOrigin;
            delete this.outstandingChanges_[origin];
          } else {
            attributes = {};
          }

          this.annotationList_.insertAnnotatedSpan(new Span(start, text.length), new RichTextAnnotation(attributes));

          newChanges.push({
            start,
            end: start,
            removedAttributes: {},
            removed: '',
            text,
            attributes,
            origin,
          });
        }
      }

      this.markLineSentinelCharactersForChanges_(cmChanges);

      if (newChanges.length > 0) {
        this.trigger('change', this, newChanges);
      }
    };

    RichTextCodeMirror.prototype.convertCoordinateSystemForChanges_ = function (changes) {
      // We have to convert the positions in the pre-change coordinate system to indexes.
      // CodeMirror's `indexFromPos` method does this for the current state of the editor.
      // We can use the information of a single change object to convert a post-change
      // coordinate system to a pre-change coordinate system. We can now proceed inductively
      // to get a pre-change coordinate system for all changes in the linked list.  A
      // disadvantage of this approach is its complexity `O(n^2)` in the length of the
      // linked list of changes.

      const self = this;
      let indexFromPos = function (pos) {
        return self.codeMirror.indexFromPos(pos);
      };

      function updateIndexFromPos(indexFromPos, change) {
        return function (pos) {
          if (posLe(pos, change.from)) {
            return indexFromPos(pos);
          }
          if (posLe(change.to, pos)) {
            return indexFromPos({
              line: pos.line + change.text.length - 1 - (change.to.line - change.from.line),
              ch: (change.to.line < pos.line)
                ? pos.ch
                : (change.text.length <= 1)
                  ? pos.ch - (change.to.ch - change.from.ch) + sumLengths(change.text)
                  : pos.ch - change.to.ch + last(change.text).length,
            }) + sumLengths(change.removed) - sumLengths(change.text);
          }
          if (change.from.line === pos.line) {
            return indexFromPos(change.from) + pos.ch - change.from.ch;
          }
          return indexFromPos(change.from)
            + sumLengths(change.removed.slice(0, pos.line - change.from.line))
            + 1 + pos.ch;
        };
      }

      const newChanges = [];
      for (let i = changes.length - 1; i >= 0; i--) {
        const change = changes[i];
        indexFromPos = updateIndexFromPos(indexFromPos, change);

        const start = indexFromPos(change.from);

        const removedText = change.removed.join('\n');
        const text = change.text.join('\n');
        newChanges.unshift({
          start,
          end: start + removedText.length,
          removed: removedText,
          text,
          origin: change.origin,
        });
      }
      return newChanges;
    };

    /**
     * Detects whether any line sentinel characters were added or removed by the change and if so,
     * re-marks line sentinel characters on the affected range of lines.
     * @param changes
     * @private
     */
    RichTextCodeMirror.prototype.markLineSentinelCharactersForChanges_ = function (changes) {
      // TODO: This doesn't handle multiple changes correctly (overlapping, out-of-oder, etc.).
      // But In practice, people using vceditor for rich-text editing don't batch multiple changes
      // together, so this isn't quite as bad as it seems.
      let startLine = Number.MAX_VALUE; let
        endLine = -1;

      for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        const { line } = change.from;
        const { ch } = change.from;

        if (change.removed.length > 1 || change.removed[0].indexOf(LineSentinelCharacter) >= 0) {
          // We removed 1+ newlines or line sentinel characters.
          startLine = Math.min(startLine, line);
          endLine = Math.max(endLine, line);
        }

        if (change.text.length > 1) { // 1+ newlines
          startLine = Math.min(startLine, line);
          endLine = Math.max(endLine, line + change.text.length - 1);
        } else if (change.text[0].indexOf(LineSentinelCharacter) >= 0) {
          startLine = Math.min(startLine, line);
          endLine = Math.max(endLine, line);
        }
      }

      // HACK: Because the above code doesn't handle multiple changes correctly, endLine might be invalid.  To
      // avoid crashing, we just cap it at the line count.
      endLine = Math.min(endLine, this.codeMirror.lineCount() - 1);

      this.markLineSentinelCharactersForChangedLines_(startLine, endLine);
    };

    RichTextCodeMirror.prototype.markLineSentinelCharactersForChangedLines_ = function (startLine, endLine) {
      // Back up to first list item.
      if (startLine < Number.MAX_VALUE) {
        while (startLine > 0 && this.lineIsListItemOrIndented_(startLine - 1)) {
          startLine--;
        }
      }

      // Advance to last list item.
      if (endLine > -1) {
        const lineCount = this.codeMirror.lineCount();
        while (endLine + 1 < lineCount && this.lineIsListItemOrIndented_(endLine + 1)) {
          endLine++;
        }
      }

      // keeps track of the list number at each indent level.
      let listNumber = [];

      const cm = this.codeMirror;
      for (let line = startLine; line <= endLine; line++) {
        const text = cm.getLine(line);

        // Remove any existing line classes.
        const lineHandle = cm.getLineHandle(line);
        cm.removeLineClass(lineHandle, 'text', '.*');

        if (text.length > 0) {
          let markIndex = text.indexOf(LineSentinelCharacter);
          while (markIndex >= 0) {
            const markStartIndex = markIndex;

            // Find the end of this series of sentinel characters, and remove any existing markers.
            while (markIndex < text.length && text[markIndex] === LineSentinelCharacter) {
              const marks = cm.findMarksAt({ line, ch: markIndex });
              for (let i = 0; i < marks.length; i++) {
                if (marks[i].isForLineSentinel) {
                  marks[i].clear();
                }
              }

              markIndex++;
            }

            this.markLineSentinelCharacters_(line, markStartIndex, markIndex, listNumber);
            markIndex = text.indexOf(LineSentinelCharacter, markIndex);
          }
        } else {
          // Reset all indents.
          listNumber = [];
        }
      }
      return endLine;
    };

    RichTextCodeMirror.prototype.markLineSentinelCharacters_ = function (line, startIndex, endIndex, listNumber) {
      const cm = this.codeMirror;
      // If the mark is at the beginning of the line and it represents a list element, we need to replace it with
      // the appropriate html element for the list heading.
      let element = null;
      var marker = null;
      const getMarkerLine = function () {
        const span = marker.find();
        return span ? span.from.line : null;
      };

      if (startIndex === 0) {
        const attributes = this.getLineAttributes_(line);
        const listType = attributes[ATTR.LIST_TYPE];
        let indent = attributes[ATTR.LINE_INDENT] || 0;
        if (listType && indent === 0) {
          indent = 1;
        }
        while (indent >= listNumber.length) {
          listNumber.push(1);
        }
        if (listType === 'o') {
          element = this.makeOrderedListElement_(listNumber[indent]);
          listNumber[indent]++;
        } else if (listType === 'u') {
          element = this.makeUnorderedListElement_();
          listNumber[indent] = 1;
        } else if (listType === 't') {
          element = this.makeTodoListElement_(false, getMarkerLine);
          listNumber[indent] = 1;
        } else if (listType === 'tc') {
          element = this.makeTodoListElement_(true, getMarkerLine);
          listNumber[indent] = 1;
        }

        const className = this.getClassNameForAttributes_(attributes);
        if (className !== '') {
          this.codeMirror.addLineClass(line, 'text', className);
        }

        // Reset deeper indents back to 1.
        listNumber = listNumber.slice(0, indent + 1);
      }

      // Create a marker to cover this series of sentinel characters.
      // NOTE: The reason we treat them as a group (one marker for all subsequent sentinel characters instead of
      // one marker for each sentinel character) is that CodeMirror seems to get angry if we don't.
      const markerOptions = { inclusiveLeft: true, collapsed: true };
      if (element) {
        markerOptions.replacedWith = element;
      }
      var marker = cm.markText({ line, ch: startIndex }, { line, ch: endIndex }, markerOptions);
      // track that it's a line-sentinel character so we can identify it later.
      marker.isForLineSentinel = true;
    };

    RichTextCodeMirror.prototype.makeOrderedListElement_ = function (number) {
      return utils.elt('div', `${number}.`, {
        class: 'vceditor-list-left',
      });
    };

    RichTextCodeMirror.prototype.makeUnorderedListElement_ = function () {
      return utils.elt('div', '\u2022', {
        class: 'vceditor-list-left',
      });
    };

    RichTextCodeMirror.prototype.toggleTodo = function (noRemove) {
      const attribute = ATTR.LIST_TYPE;
      const currentAttributes = this.getCurrentLineAttributes_();
      let newValue;
      if (!(attribute in currentAttributes) || ((currentAttributes[attribute] !== 't') && (currentAttributes[attribute] !== 'tc'))) {
        newValue = 't';
      } else if (currentAttributes[attribute] === 't') {
        newValue = 'tc';
      } else if (currentAttributes[attribute] === 'tc') {
        newValue = noRemove ? 't' : false;
      }
      this.setLineAttribute(attribute, newValue);
    };

    RichTextCodeMirror.prototype.makeTodoListElement_ = function (checked, getMarkerLine) {
      const params = {
        type: 'checkbox',
        class: 'vceditor-todo-left',
      };
      if (checked) params.checked = true;
      const el = utils.elt('input', false, params);
      const self = this;
      utils.on(el, 'click', utils.stopEventAnd((e) => {
        self.codeMirror.setCursor({ line: getMarkerLine(), ch: 1 });
        self.toggleTodo(true);
      }));
      return el;
    };

    RichTextCodeMirror.prototype.lineIsListItemOrIndented_ = function (lineNum) {
      const attrs = this.getLineAttributes_(lineNum);
      return ((attrs[ATTR.LIST_TYPE] || false) !== false)
        || ((attrs[ATTR.LINE_INDENT] || 0) !== 0);
    };

    RichTextCodeMirror.prototype.onCursorActivity_ = function () {
      const self = this;

      clearTimeout(self.cursorTimeout);
      self.cursorTimeout = setTimeout(() => {
        self.updateCurrentAttributes_();
      }, 1);
    };

    RichTextCodeMirror.prototype.getCurrentAttributes_ = function () {
      if (!this.currentAttributes_) {
        this.updateCurrentAttributes_();
      }
      return this.currentAttributes_;
    };

    RichTextCodeMirror.prototype.updateCurrentAttributes_ = function () {
      const cm = this.codeMirror;
      const anchor = cm.indexFromPos(cm.getCursor('anchor')); const
        head = cm.indexFromPos(cm.getCursor('head'));
      let pos = head;
      if (anchor > head) { // backwards selection
        // Advance past any newlines or line sentinels.
        while (pos < this.end()) {
          var c = this.getRange(pos, pos + 1);
          if (c !== '\n' && c !== LineSentinelCharacter) break;
          pos++;
        }
        if (pos < this.end()) pos++; // since we're going to look at the annotation span to the left to decide what attributes to use.
      } else {
        // Back up before any newlines or line sentinels.
        while (pos > 0) {
          c = this.getRange(pos - 1, pos);
          if (c !== '\n' && c !== LineSentinelCharacter) break;
          pos--;
        }
      }
      const spans = this.annotationList_.getAnnotatedSpansForPos(pos);
      this.currentAttributes_ = {};

      let attributes = {};
      // Use the attributes to the left unless they're line attributes (in which case use the ones to the right.
      if (spans.length > 0 && (!(ATTR.LINE_SENTINEL in spans[0].annotation.attributes))) {
        attributes = spans[0].annotation.attributes;
      } else if (spans.length > 1) {
        vceditor.utils.assert(!(ATTR.LINE_SENTINEL in spans[1].annotation.attributes), "Cursor can't be between two line sentinel characters.");
        attributes = spans[1].annotation.attributes;
      }
      for (const attr in attributes) {
        // Don't copy line or entity attributes.
        if (attr !== 'l' && attr !== 'lt' && attr !== 'li' && attr.indexOf(ATTR.ENTITY_SENTINEL) !== 0) {
          this.currentAttributes_[attr] = attributes[attr];
        }
      }
    };

    RichTextCodeMirror.prototype.getCurrentLineAttributes_ = function () {
      const cm = this.codeMirror;
      const anchor = cm.getCursor('anchor'); const
        head = cm.getCursor('head');
      let { line } = head;
      // If it's a forward selection and the cursor is at the beginning of a line, use the previous line.
      if (head.ch === 0 && anchor.line < head.line) {
        line--;
      }
      return this.getLineAttributes_(line);
    };

    RichTextCodeMirror.prototype.getLineAttributes_ = function (lineNum) {
      const attributes = {};
      const line = this.codeMirror.getLine(lineNum);
      if (line.length > 0 && line[0] === LineSentinelCharacter) {
        const lineStartIndex = this.codeMirror.indexFromPos({ line: lineNum, ch: 0 });
        const spans = this.annotationList_.getAnnotatedSpansForSpan(new Span(lineStartIndex, 1));
        vceditor.utils.assert(spans.length === 1);
        for (const attr in spans[0].annotation.attributes) {
          attributes[attr] = spans[0].annotation.attributes[attr];
        }
      }
      return attributes;
    };

    RichTextCodeMirror.prototype.clearAnnotations_ = function () {
      this.annotationList_.updateSpan(new Span(0, this.end()), (annotation, length) => new RichTextAnnotation({}));
    };

    RichTextCodeMirror.prototype.newline = function () {
      const cm = this.codeMirror;
      const self = this;
      if (!this.emptySelection_()) {
        cm.replaceSelection('\n', 'end', '+input');
      } else {
        const cursorLine = cm.getCursor('head').line;
        const lineAttributes = this.getLineAttributes_(cursorLine);
        const listType = lineAttributes[ATTR.LIST_TYPE];

        if (listType && cm.getLine(cursorLine).length === 1) {
          // They hit enter on a line with just a list heading.  Just remove the list heading.
          this.updateLineAttributes(cursorLine, cursorLine, (attributes) => {
            delete attributes[ATTR.LIST_TYPE];
            delete attributes[ATTR.LINE_INDENT];
          });
        } else {
          cm.replaceSelection('\n', 'end', '+input');

          // Copy line attributes forward.
          this.updateLineAttributes(cursorLine + 1, cursorLine + 1, (attributes) => {
            for (const attr in lineAttributes) {
              attributes[attr] = lineAttributes[attr];
            }

            // Don't mark new todo items as completed.
            if (listType === 'tc') attributes[ATTR.LIST_TYPE] = 't';
            self.trigger('newLine', { line: cursorLine + 1, attr: attributes });
          });
        }
      }
    };

    RichTextCodeMirror.prototype.deleteLeft = function () {
      const cm = this.codeMirror;
      const cursorPos = cm.getCursor('head');
      const lineAttributes = this.getLineAttributes_(cursorPos.line);
      const listType = lineAttributes[ATTR.LIST_TYPE];
      const indent = lineAttributes[ATTR.LINE_INDENT];

      const backspaceAtStartOfLine = this.emptySelection_() && cursorPos.ch === 1;

      if (backspaceAtStartOfLine && listType) {
        // They hit backspace at the beginning of a line with a list heading.  Just remove the list heading.
        this.updateLineAttributes(cursorPos.line, cursorPos.line, (attributes) => {
          delete attributes[ATTR.LIST_TYPE];
          delete attributes[ATTR.LINE_INDENT];
        });
      } else if (backspaceAtStartOfLine && indent && indent > 0) {
        this.updateLineAttributes(cursorPos.line, cursorPos.line, (attributes) => {
          attributes[ATTR.LINE_INDENT]--;
        });
      } else {
        cm.deleteH(-1, 'char');
      }
    };

    RichTextCodeMirror.prototype.deleteRight = function () {
      const cm = this.codeMirror;
      const cursorPos = cm.getCursor('head');

      const text = cm.getLine(cursorPos.line);
      const emptyLine = this.areLineSentinelCharacters_(text);
      const nextLineText = (cursorPos.line + 1 < cm.lineCount()) ? cm.getLine(cursorPos.line + 1) : '';
      if (this.emptySelection_() && emptyLine && nextLineText[0] === LineSentinelCharacter) {
        // Delete the empty line but not the line sentinel character on the next line.
        cm.replaceRange('', { line: cursorPos.line, ch: 0 }, { line: cursorPos.line + 1, ch: 0 }, '+input');
      } else {
        cm.deleteH(1, 'char');
      }
    };

    RichTextCodeMirror.prototype.indent = function () {
      this.updateLineAttributesForSelection((attributes) => {
        const indent = attributes[ATTR.LINE_INDENT];
        const listType = attributes[ATTR.LIST_TYPE];

        if (indent) {
          attributes[ATTR.LINE_INDENT]++;
        } else if (listType) {
          // lists are implicitly already indented once.
          attributes[ATTR.LINE_INDENT] = 2;
        } else {
          attributes[ATTR.LINE_INDENT] = 1;
        }
      });
    };

    RichTextCodeMirror.prototype.unindent = function () {
      this.updateLineAttributesForSelection((attributes) => {
        const indent = attributes[ATTR.LINE_INDENT];

        if (indent && indent > 1) {
          attributes[ATTR.LINE_INDENT] = indent - 1;
        } else {
          delete attributes[ATTR.LIST_TYPE];
          delete attributes[ATTR.LINE_INDENT];
        }
      });
    };

    RichTextCodeMirror.prototype.getText = function () {
      return this.codeMirror.getValue().replace(new RegExp(LineSentinelCharacter, 'g'), '');
    };

    RichTextCodeMirror.prototype.areLineSentinelCharacters_ = function (text) {
      for (let i = 0; i < text.length; i++) {
        if (text[i] !== LineSentinelCharacter) return false;
      }
      return true;
    };

    /**
     * Used for the annotations we store in our AnnotationList.
     * @param attributes
     * @constructor
     */
    function RichTextAnnotation(attributes) {
      this.attributes = attributes || {};
    }

    RichTextAnnotation.prototype.equals = function (other) {
      if (!(other instanceof RichTextAnnotation)) {
        return false;
      }
      let attr;
      for (attr in this.attributes) {
        if (other.attributes[attr] !== this.attributes[attr]) {
          return false;
        }
      }

      for (attr in other.attributes) {
        if (other.attributes[attr] !== this.attributes[attr]) {
          return false;
        }
      }

      return true;
    };

    function emptyAttributes(attributes) {
      for (const attr in attributes) {
        return false;
      }
      return true;
    }

    // Bind a method to an object, so it doesn't matter whether you call
    // object.method() directly or pass object.method as a reference to another
    // function.
    function bind(obj, method) {
      const fn = obj[method];
      obj[method] = function () {
        fn.apply(obj, arguments);
      };
    }

    return RichTextCodeMirror;
  }());

  var vceditor = vceditor || {};

  // TODO: Can this derive from CodeMirrorAdapter or similar?
  // vceditor.RichTextCodeMirrorAdapter = window.RichTextCodeMirrorAdapter;
  vceditor.RichTextCodeMirrorAdapter = vceditor.Client;

  var vceditor = vceditor || {};

  /**
   * Immutable object to represent text formatting.  Formatting can be modified by chaining method calls.
   *
   * @constructor
   * @type {Function}
   */
  vceditor.Formatting = (function () {
    const ATTR = vceditor.AttributeConstants;

    function Formatting(attributes) {
      // Allow calling without new.
      if (!(this instanceof Formatting)) {
        return new Formatting(attributes);
      }

      this.attributes = attributes || {};
    }

    Formatting.prototype.cloneWithNewAttribute_ = function (attribute, value) {
      const attributes = {};

      // Copy existing.
      for (const attr in this.attributes) {
        attributes[attr] = this.attributes[attr];
      }

      // Add new one.
      if (value === false) {
        delete attributes[attribute];
      } else {
        attributes[attribute] = value;
      }

      return new Formatting(attributes);
    };

    Formatting.prototype.bold = function (val) {
      return this.cloneWithNewAttribute_(ATTR.BOLD, val);
    };

    Formatting.prototype.italic = function (val) {
      return this.cloneWithNewAttribute_(ATTR.ITALIC, val);
    };

    Formatting.prototype.underline = function (val) {
      return this.cloneWithNewAttribute_(ATTR.UNDERLINE, val);
    };

    Formatting.prototype.strike = function (val) {
      return this.cloneWithNewAttribute_(ATTR.STRIKE, val);
    };

    Formatting.prototype.font = function (font) {
      return this.cloneWithNewAttribute_(ATTR.FONT, font);
    };

    Formatting.prototype.fontSize = function (size) {
      return this.cloneWithNewAttribute_(ATTR.FONT_SIZE, size);
    };

    Formatting.prototype.color = function (color) {
      return this.cloneWithNewAttribute_(ATTR.COLOR, color);
    };

    Formatting.prototype.backgroundColor = function (color) {
      return this.cloneWithNewAttribute_(ATTR.BACKGROUND_COLOR, color);
    };

    return Formatting;
  }());

  var vceditor = vceditor || {};

  /**
   * Object to represent Formatted text.
   *
   * @type {Function}
   */
  vceditor.Text = (function () {
    function Text(text, formatting) {
      // Allow calling without new.
      if (!(this instanceof Text)) {
        return new Text(text, formatting);
      }

      this.text = text;
      this.formatting = formatting || vceditor.Formatting();
    }

    return Text;
  }());

  // var vceditor = vceditor || {};

  vceditor.LineFormatting = window.LineFormatting;

  //   var vceditor = vceditor || {};

  /**
   * Object to represent Formatted line.
   *
   * @type {Function}
   */
  vceditor.Line = (function () {
    function Line(textPieces, formatting) {
      // Allow calling without new.
      if (!(this instanceof Line)) {
        return new Line(textPieces, formatting);
      }

      if (Object.prototype.toString.call(textPieces) !== '[object Array]') {
        if (typeof textPieces === 'undefined') {
          textPieces = [];
        } else {
          textPieces = [textPieces];
        }
      }

      this.textPieces = textPieces;
      this.formatting = formatting || vceditor.LineFormatting();
    }

    return Line;
  }());

  //    var vceditor = vceditor || {};

  /**
   * Helper to parse html into Vceditor-compatible lines / text.
   * @type {*}
   */

  vceditor.ParseHtml = window.ParseHtml;

  vceditor.SerializeHtml = window.SerializeHtml;


  /**
   * Helper to turn pieces of text into insertable operations
   */
  vceditor.textPiecesToInserts = function (atNewLine, textPieces) {
    const inserts = [];

    function insert(string, attributes) {
      if (string instanceof vceditor.Text) {
        attributes = string.formatting.attributes;
        string = string.text;
      }

      inserts.push({ string, attributes });
      atNewLine = string[string.length - 1] === '\n';
    }

    function insertLine(line) {
      // HACK: We should probably force a newline if there isn't one already.  But due to
      // the way this is used for inserting HTML, we end up inserting a "line" in the middle
      // of text, in which case we don't want to actually insert a newline.
      if (atNewLine) {
        insert(vceditor.sentinelConstants.LINE_SENTINEL_CHARACTER, line.formatting.attributes);
      }

      for (let i = 0; i < line.textPieces.length; i++) {
        insert(line.textPieces[i]);
      }

      insert('\n');
    }

    for (let i = 0; i < textPieces.length; i++) {
      if (textPieces[i] instanceof vceditor.Line) {
        insertLine(textPieces[i]);
      } else {
        insert(textPieces[i]);
      }
    }

    return inserts;
  };


  var vceditor = vceditor || {};

  vceditor.Vceditor = (function (global) {
    if (!vceditor.RichTextCodeMirrorAdapter) {
      throw new Error("Oops! It looks like you're trying to include lib/vceditor.js directly.  This is actually one of many source files that make up vceditor.  You want dist/vceditor.js instead.");
    }
    const { RichTextCodeMirrorAdapter } = vceditor;
    const { RichTextCodeMirror } = vceditor;
    const { RichTextToolbar } = vceditor;
    const { ACEAdapter } = vceditor;
    // var Adapter = vceditor.Adapter;
    const { EditorClient } = vceditor;
    const { EntityManager } = vceditor;
    const ATTR = vceditor.AttributeConstants;
    const { utils } = vceditor;
    const { LIST_TYPE } = vceditor.LineFormatting;
    const { CodeMirror } = global;
    const { ace } = global;

    function Vceditor(ref, place, options, editorInfo) {
      if (!(this instanceof Vceditor)) {
        return new Vceditor(ref, place, options, editorInfo);
      }

      if (!CodeMirror && !ace) {
        throw new Error('Couldn\'t find CodeMirror or ACE.  Did you forget to include codemirror.js or ace.js?');
      }

      if (CodeMirror && place instanceof CodeMirror) {
        this.codeMirror_ = this.editor_ = place;
        var curValue = this.codeMirror_.getValue();
        if (curValue !== '') {
          // throw new Error("Can't initialize Vceditor with a CodeMirror instance that already contains text.");
          // console.log("Can't initialize Vceditor with a CodeMirror instance that already contains text.");
        }
      } else if (ace && place && place.session instanceof ace.EditSession) {
        this.ace_ = this.editor_ = place;
        curValue = this.ace_.getValue();
        if (curValue !== '') {
          throw new Error("Can't initialize Vceditor with an ACE instance that already contains text.");
        }
      } else {
        this.codeMirror_ = this.editor_ = new CodeMirror(place);
      }

      const editorWrapper = this.codeMirror_ ? this.codeMirror_.getWrapperElement() : this.ace_.container;
      this.vcEditorWrapper_ = utils.elt('div', null, { class: 'vceditor' });
      editorWrapper.parentNode.replaceChild(this.vcEditorWrapper_, editorWrapper);
      this.vcEditorWrapper_.appendChild(editorWrapper);

      // Don't allow drag/drop because it causes issues.  See https://github.com//vceditor/issues/36
      utils.on(editorWrapper, 'dragstart', utils.stopEvent);

      // Provide an easy way to get the vceditor instance associated with this CodeMirror instance.
      this.editor_.vceditor = this;

      this.options_ = options || {};

      if (this.getOption('richTextShortcuts', false)) {
        if (!CodeMirror.keyMap.richtext) {
          this.initializeKeyMap_();
        }

        this.codeMirror_.setOption('keyMap', 'richtext');
        this.vcEditorWrapper_.className += ' vceditor-richtext';
      }

      this.imageInsertionUI = this.getOption('imageInsertionUI', true);

      if (this.getOption('richTextToolbar', false)) {
        this.addToolbar_();
        this.vcEditorWrapper_.className += ' vceditor-richtext vceditor-with-toolbar';
      }

      this.addPoweredByLogo_();

      // Now that we've mucked with CodeMirror, refresh it.
      if (this.codeMirror_) this.codeMirror_.refresh();

      // var userId = this.getOption('userId', ref.push().key());
      const userId = 'JqrwCaZm29-CLg-Pfz2';
      const userColor = this.getOption('userColor', colorFromUserId(userId));

      this.entityManager_ = new EntityManager();

      // this.Adapter_ = new Adapter(ref, userId, userColor);
      const { revision } = editorInfo;
      const clients = [];
      const docs = '';
      const operations = '';
      // this.vcAdapter =   new otAdapter(revision, docs, operations);

      //      virtualclass.editorRich.vcAdapter =   new otAdapter(editorInfo, virtualclass.currApp);

      if (this.codeMirror_) {
        this.richTextCodeMirror_ = new RichTextCodeMirror(this.codeMirror_, this.entityManager_, { cssPrefix: 'vceditor-' });
        this.editorAdapter_ = new RichTextCodeMirrorAdapter(this.richTextCodeMirror_);
      } else {
        this.editorAdapter_ = new ACEAdapter(this.ace_);
      }

      //  virtualclass.editorRich.cmClient = new EditorClient(revision, clients, virtualclass.editorRich.vcAdapter, this.editorAdapter_);
      // TODO this should be dynamic

      if (Object.prototype.hasOwnProperty.call(options, 'richTextToolbar')) {
        // if(virtualclass.currApp == "Editor"){
        virtualclass.editorRich.vcAdapter = new otAdapter(editorInfo, 'EditorRich');
        virtualclass.editorRich.cmClient = new EditorClient(revision, clients, virtualclass.editorRich.vcAdapter, this.editorAdapter_);
      } else {
        virtualclass.editorCode.vcAdapter = new otAdapter(editorInfo, 'EditorCode');
        virtualclass.editorCode.cmClient = new EditorClient(revision, clients, virtualclass.editorCode.vcAdapter, this.editorAdapter_);
      }


      // Hack for IE8 to make font icons work more reliably.
      // http://stackoverflow.com/questions/9809351/ie8-css-font-face-fonts-only-working-for-before-content-on-over-and-sometimes
      if (navigator.appName == 'Microsoft Internet Explorer' && navigator.userAgent.match(/MSIE 8\./)) {
        window.onload = function () {
          const head = document.getElementsByTagName('head')[0];
          const style = document.createElement('style');
          style.type = 'text/css';
          style.styleSheet.cssText = ':before,:after{content:none !important;}';
          head.appendChild(style);
          setTimeout(() => {
            head.removeChild(style);
          }, 0);
        };
      }
    }

    utils.makeEventEmitter(Vceditor);

    // For readability, these are the primary "constructors", even though right now they're just aliases for Vceditor.
    Vceditor.fromCodeMirror = Vceditor;
    Vceditor.fromACE = Vceditor;

    Vceditor.prototype.dispose = function () {
      this.zombie_ = true; // We've been disposed.  No longer valid to do anything.

      // Unwrap the editor.
      const editorWrapper = this.codeMirror_ ? this.codeMirror_.getWrapperElement() : this.ace_.container;
      this.vcEditorWrapper_.removeChild(editorWrapper);
      this.vcEditorWrapper_.parentNode.replaceChild(editorWrapper, this.vcEditorWrapper_);

      this.editor_.vceditor = null;

      if (this.codeMirror_ && this.codeMirror_.getOption('keyMap') === 'richtext') {
        this.codeMirror_.setOption('keyMap', 'default');
      }

      this.vcAdapter.dispose();
      this.editorAdapter_.detach();
      if (this.richTextCodeMirror_) this.richTextCodeMirror_.detach();
    };

    Vceditor.prototype.setUserId = function (userId) {
      this.vcAdapter.setUserId(userId);
    };

    Vceditor.prototype.setUserColor = function (color) {
      this.vcAdapter.setColor(color);
    };

    Vceditor.prototype.getText = function () {
      this.assertReady_('getText');
      if (this.codeMirror_) return this.richTextCodeMirror_.getText();
      return this.ace_.getSession().getDocument().getValue();
    };

    Vceditor.prototype.setText = function (textPieces) {
      if (this.ace_) {
        return this.ace_.getSession().getDocument().setValue(textPieces);
      }
      // HACK: Hide CodeMirror during setText to prevent lots of extra renders.
      this.codeMirror_.getWrapperElement().setAttribute('style', 'display: none');
      this.codeMirror_.setValue('');
      this.insertText(0, textPieces);
      this.codeMirror_.getWrapperElement().setAttribute('style', '');
      this.codeMirror_.refresh();
    };

    Vceditor.prototype.insertTextAtCursor = function (textPieces) {
      this.insertText(this.codeMirror_.indexFromPos(this.codeMirror_.getCursor()), textPieces);
    };

    Vceditor.prototype.insertText = function (index, textPieces) {
      utils.assert(!this.ace_, 'Not supported for ace yet.');
      this.assertReady_('insertText');

      // Wrap it in an array if it's not already.
      if (Object.prototype.toString.call(textPieces) !== '[object Array]') {
        textPieces = [textPieces];
      }

      // TODO: Batch this all into a single operation.
      // HACK: We should check if we're actually at the beginning of a line; but checking for index == 0 is sufficient
      // for the setText() case.
      const atNewLine = index === 0;
      const inserts = vceditor.textPiecesToInserts(atNewLine, textPieces);

      for (let i = 0; i < inserts.length; i++) {
        const { string } = inserts[i];
        const { attributes } = inserts[i];
        this.richTextCodeMirror_.insertText(index, string, attributes);
        index += string.length;
      }
    };

    Vceditor.prototype.getOperationForSpan = function (start, end) {
      const text = this.richTextCodeMirror_.getRange(start, end);
      const spans = this.richTextCodeMirror_.getAttributeSpans(start, end);
      let pos = 0;
      const op = new vceditor.TextOperation();
      for (let i = 0; i < spans.length; i++) {
        op.insert(text.substr(pos, spans[i].length), spans[i].attributes);
        pos += spans[i].length;
      }
      return op;
    };

    Vceditor.prototype.getHtml = function () {
      return this.getHtmlFromRange(null, null);
    };

    Vceditor.prototype.getHtmlFromSelection = function () {
      const startPos = this.codeMirror_.getCursor('start'); const
        endPos = this.codeMirror_.getCursor('end');
      const startIndex = this.codeMirror_.indexFromPos(startPos); const
        endIndex = this.codeMirror_.indexFromPos(endPos);
      return this.getHtmlFromRange(startIndex, endIndex);
    };

    Vceditor.prototype.getHtmlFromRange = function (start, end) {
      const doc = (start != null && end != null)
        ? this.getOperationForSpan(start, end)
        : this.getOperationForSpan(0, this.codeMirror_.getValue().length);
      return vceditor.SerializeHtml(doc, this.entityManager_);
    };

    Vceditor.prototype.insertHtml = function (index, html) {
      const lines = vceditor.ParseHtml(html, this.entityManager_);
      this.insertText(index, lines);
    };

    Vceditor.prototype.insertHtmlAtCursor = function (html) {
      this.insertHtml(this.codeMirror_.indexFromPos(this.codeMirror_.getCursor()), html);
    };

    Vceditor.prototype.setHtml = function (html) {
      const lines = vceditor.ParseHtml(html, this.entityManager_);
      this.setText(lines);
    };

    Vceditor.prototype.isHistoryEmpty = function () {
      this.assertReady_('isHistoryEmpty');
      return this.vcAdapter.isHistoryEmpty();
    };

    Vceditor.prototype.bold = function () {
      this.richTextCodeMirror_.toggleAttribute(ATTR.BOLD);
      this.codeMirror_.focus();
    };

    Vceditor.prototype.italic = function () {
      this.richTextCodeMirror_.toggleAttribute(ATTR.ITALIC);
      this.codeMirror_.focus();
    };

    Vceditor.prototype.underline = function () {
      this.richTextCodeMirror_.toggleAttribute(ATTR.UNDERLINE);
      this.codeMirror_.focus();
    };

    Vceditor.prototype.strike = function () {
      this.richTextCodeMirror_.toggleAttribute(ATTR.STRIKE);
      this.codeMirror_.focus();
    };

    Vceditor.prototype.fontSize = function (size) {
      this.richTextCodeMirror_.setAttribute(ATTR.FONT_SIZE, size);
      this.codeMirror_.focus();
    };

    Vceditor.prototype.font = function (font) {
      this.richTextCodeMirror_.setAttribute(ATTR.FONT, font);
      this.codeMirror_.focus();
    };

    Vceditor.prototype.color = function (color) {
      this.richTextCodeMirror_.setAttribute(ATTR.COLOR, color);
      this.codeMirror_.focus();
    };

    Vceditor.prototype.highlight = function () {
      this.richTextCodeMirror_.toggleAttribute(ATTR.BACKGROUND_COLOR, 'rgba(255,255,0,.65)');
      this.codeMirror_.focus();
    };

    Vceditor.prototype.align = function (alignment) {
      if (alignment !== 'left' && alignment !== 'center' && alignment !== 'right') {
        throw new Error('align() must be passed "left", "center", or "right".');
      }
      this.richTextCodeMirror_.setLineAttribute(ATTR.LINE_ALIGN, alignment);
      this.codeMirror_.focus();
    };

    Vceditor.prototype.orderedList = function () {
      this.richTextCodeMirror_.toggleLineAttribute(ATTR.LIST_TYPE, 'o');
      this.codeMirror_.focus();
    };

    Vceditor.prototype.unorderedList = function () {
      this.richTextCodeMirror_.toggleLineAttribute(ATTR.LIST_TYPE, 'u');
      this.codeMirror_.focus();
    };

    Vceditor.prototype.todo = function () {
      this.richTextCodeMirror_.toggleTodo();
      this.codeMirror_.focus();
    };

    Vceditor.prototype.newline = function () {
      this.richTextCodeMirror_.newline();
    };

    Vceditor.prototype.deleteLeft = function () {
      this.richTextCodeMirror_.deleteLeft();
    };

    Vceditor.prototype.deleteRight = function () {
      this.richTextCodeMirror_.deleteRight();
    };

    Vceditor.prototype.indent = function () {
      this.richTextCodeMirror_.indent();
      this.codeMirror_.focus();
    };

    Vceditor.prototype.unindent = function () {
      this.richTextCodeMirror_.unindent();
      this.codeMirror_.focus();
    };

    Vceditor.prototype.undo = function () {
      this.codeMirror_.undo();
    };

    Vceditor.prototype.redo = function () {
      this.codeMirror_.redo();
    };

    Vceditor.prototype.insertEntity = function (type, info, origin) {
      this.richTextCodeMirror_.insertEntityAtCursor(type, info, origin);
    };

    Vceditor.prototype.insertEntityAt = function (index, type, info, origin) {
      this.richTextCodeMirror_.insertEntityAt(index, type, info, origin);
    };

    Vceditor.prototype.registerEntity = function (type, options) {
      this.entityManager_.register(type, options);
    };

    Vceditor.prototype.getOption = function (option, def) {
      return (option in this.options_) ? this.options_[option] : def;
    };

    Vceditor.prototype.assertReady_ = function (funcName) {
      if (!this.ready_) {
        throw new Error(`You must wait for the "ready" event before calling ${funcName}.`);
      }
      if (this.zombie_) {
        throw new Error('You can\'t use a Vceditor after calling dispose()!');
      }
    };

    Vceditor.prototype.makeImageDialog_ = function () {
      this.makeDialog_('img', virtualclass.lang.getString('InsertimageURL'));
    };

    Vceditor.prototype.makeDialog_ = function (id, placeholder) {
      const self = this;

      const hideDialog = function () {
        const dialog = document.getElementById('overlay');
        dialog.style.visibility = 'hidden';
        self.vcEditorWrapper_.removeChild(dialog);
      };

      const cb = function () {
        const dialog = document.getElementById('overlay');
        dialog.style.visibility = 'hidden';
        const src = document.getElementById(id).value;
        if (src) {
          self.insertEntity(id, { src });
        }
        self.vcEditorWrapper_.removeChild(dialog);
      };

      const input = utils.elt('input', null, {
        class: 'vceditor-dialog-input',
        id,
        type: 'text',
        placeholder,
        autofocus: 'autofocus',
      });

      const submit = utils.elt('a', 'Submit', { class: 'vceditor-btn', id: 'submitbtn' });
      utils.on(submit, 'click', utils.stopEventAnd(cb));

      const cancel = utils.elt('a', 'Cancel', { class: 'vceditor-btn' });
      utils.on(cancel, 'click', utils.stopEventAnd(hideDialog));

      const buttonsdiv = utils.elt('div', [submit, cancel], { class: 'vceditor-btn-group' });

      const div = utils.elt('div', [input, buttonsdiv], { class: 'vceditor-dialog-div' });
      const dialog = utils.elt('div', [div], { class: 'vceditor-dialog', id: 'overlay' });

      this.vcEditorWrapper_.appendChild(dialog);
    };

    Vceditor.prototype.addToolbar_ = function () {
      this.toolbar = new RichTextToolbar(this.imageInsertionUI);

      this.toolbar.on('undo', this.undo, this);
      this.toolbar.on('redo', this.redo, this);
      this.toolbar.on('bold', this.bold, this);
      this.toolbar.on('italic', this.italic, this);
      this.toolbar.on('underline', this.underline, this);
      this.toolbar.on('strike', this.strike, this);
      this.toolbar.on('font-size', this.fontSize, this);
      this.toolbar.on('font', this.font, this);
      this.toolbar.on('color', this.color, this);
      this.toolbar.on('left', function () {
        this.align('left');
      }, this);
      this.toolbar.on('center', function () {
        this.align('center');
      }, this);
      this.toolbar.on('right', function () {
        this.align('right');
      }, this);
      this.toolbar.on('ordered-list', this.orderedList, this);
      this.toolbar.on('unordered-list', this.unorderedList, this);
      this.toolbar.on('todo-list', this.todo, this);
      this.toolbar.on('indent-increase', this.indent, this);
      this.toolbar.on('indent-decrease', this.unindent, this);
      this.toolbar.on('insert-image', this.makeImageDialog_, this);

      this.vcEditorWrapper_.insertBefore(this.toolbar.element(), this.vcEditorWrapper_.firstChild);
    };

    Vceditor.prototype.addPoweredByLogo_ = function () {
      // var poweredBy = utils.elt('a', null, {'class': 'powered-by-vceditor'});
      // poweredBy.setAttribute('href', 'http://www.vceditor.io/');
      // poweredBy.setAttribute('target', '_blank');
      // this.vcEditorWrapper_.appendChild(poweredBy)
    };

    Vceditor.prototype.initializeKeyMap_ = function () {
      function binder(fn) {
        return function (cm) {
          // HACK: CodeMirror will often call our key handlers within a cm.operation(), and that
          // can mess us up (we rely on events being triggered synchronously when we make CodeMirror
          // edits).  So to escape any cm.operation(), we do a setTimeout.
          setTimeout(() => {
            fn.call(cm.vceditor);
          }, 0);
        };
      }


      // changed by suman
      // We don't need this handler when the
      // editor is OFF
      if (!this.getOption('readOnly')) {
        CodeMirror.keyMap.richtext = {
          'Ctrl-B': binder(this.bold),
          'Cmd-B': binder(this.bold),
          'Ctrl-I': binder(this.italic),
          'Cmd-I': binder(this.italic),
          'Ctrl-U': binder(this.underline),
          'Cmd-U': binder(this.underline),
          'Ctrl-H': binder(this.highlight),
          'Cmd-H': binder(this.highlight),
          Enter: binder(this.newline),
          Delete: binder(this.deleteRight),
          Backspace: binder(this.deleteLeft),
          Tab: binder(this.indent),
          'Shift-Tab': binder(this.unindent),
          fallthrough: ['default'],
        };
      } else {
        CodeMirror.keyMap.richtext = {
          fallthrough: ['default'],
        };
      }
    };

    function colorFromUserId(userId) {
      let a = 1;
      for (let i = 0; i < userId.length; i++) {
        a = 17 * (a + userId.charCodeAt(i)) % 360;
      }
      const hue = a / 360;

      return hsl2hex(hue, 1, 0.85);
    }

    function rgb2hex(r, g, b) {
      function digits(n) {
        const m = Math.round(255 * n).toString(16);
        return m.length === 1 ? `0${m}` : m;
      }

      return `#${digits(r)}${digits(g)}${digits(b)}`;
    }

    function hsl2hex(h, s, l) {
      if (s === 0) {
        return rgb2hex(l, l, l);
      }
      const var2 = l < 0.5 ? l * (1 + s) : (l + s) - (s * l);
      const var1 = 2 * l - var2;
      const hue2rgb = function (hue) {
        if (hue < 0) {
          hue += 1;
        }
        if (hue > 1) {
          hue -= 1;
        }
        if (6 * hue < 1) {
          return var1 + (var2 - var1) * 6 * hue;
        }
        if (2 * hue < 1) {
          return var2;
        }
        if (3 * hue < 2) {
          return var1 + (var2 - var1) * 6 * (2 / 3 - hue);
        }
        return var1;
      };
      return rgb2hex(hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3));
    }


    return Vceditor;
  }(window));

  // Export Text classes
  vceditor.Vceditor.Formatting = vceditor.Formatting;
  vceditor.Vceditor.Text = vceditor.Text;
  vceditor.Vceditor.Entity = vceditor.Entity;
  vceditor.Vceditor.LineFormatting = vceditor.LineFormatting;
  vceditor.Vceditor.Line = vceditor.Line;
  vceditor.Vceditor.TextOperation = vceditor.TextOperation;
  // vceditor.Vceditor.Headless = vceditor.Headless;

  // Export adapters
  vceditor.Vceditor.RichTextCodeMirrorAdapter = vceditor.RichTextCodeMirrorAdapter;
  // vceditor.Vceditor.ACEAdapter = vceditor.ACEAdapter;

  vceditor.Server = Server;


  vceditor.Vceditor.getvcEditor = function () {
    return vceditor;
  };

  return vceditor.Vceditor;
}(window));

window.Vceditor = Vceditor;
