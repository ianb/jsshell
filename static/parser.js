(function() {
  var BACKSLASH_SPECIAL, Node, Point, WHITESPACES, parse, _parseArg, _parseArgs, _parseInterpolate, _parseSingleQuote, _parseVar;
  var __hasProp = Object.prototype.hasOwnProperty, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  BACKSLASH_SPECIAL = {
    "n": "\n",
    "r": "\r",
    "t": "\t"
  };
  WHITESPACES = {
    " ": null,
    "\n": null,
    "\r": null,
    "\t": null
  };
  Node = (function() {
    function Node(t, attrs, children) {
      var name, value;
      this.t = t;
      if (attrs != null) {
        for (name in attrs) {
          if (!__hasProp.call(attrs, name)) continue;
          value = attrs[name];
          this[name] = value;
        }
      }
      if (children != null) {
        if (!typeof children === 'string' && !children.length) {
          this.c = [children];
        } else {
          this.c = children;
        }
      } else {
        this.c = '';
      }
    }
    Node.prototype.toXML = function() {
      var item, name, s, _i, _len, _ref;
      s = '<' + this.t;
      for (name in this) {
        if (!__hasProp.call(this, name)) continue;
        if (name === 't' || name === 'c' || this[name] === null) {
          continue;
        }
        s += ' ' + name + '="' + this._quote(this[name]) + '"';
      }
      if (!this.c) {
        s += ' />';
        return s;
      }
      s += '>';
      if (typeof this.c === 'string') {
        s += this._quote(this.c);
      } else {
        _ref = this.c;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          item = _ref[_i];
          if (typeof item === 'string') {
            s += this._quote(item);
          } else {
            s += item.toXML();
          }
        }
      }
      s += '</' + this.t + '>';
      return s;
    };
    Node.prototype._quote = function(s) {
      if (s === true) {
        return '1';
      }
      return s.replace('&', '&amp;').replace('<', '&lt;').replace('"', '&quot;');
    };
    Node.prototype.pushString = function(s) {
      if (typeof this.c === 'string') {
        return this.c += s;
      } else if (typeof this.c[this.c.length - 1] === 'string') {
        return this.c[this.c.length - 1] = this.c[this.c.length - 1] + s;
      } else {
        return this.c.push(s);
      }
    };
    Node.prototype.push = function(node) {
      if (typeof node === 'string') {
        return this.pushString(node);
      } else if (typeof this.c === 'string') {
        return this.c = [this.c, node];
      } else {
        return this.c.push(node);
      }
    };
    Node.prototype.lastChildNode = function() {
      if (typeof this.c === 'string') {
        return null;
      } else if (typeof this.c[this.c.length - 1] === 'string') {
        return null;
      } else {
        return this.c[this.c.length - 1];
      }
    };
    Node.prototype.toCommand = function() {
      if (this.t === 'arg' || this.t === 'span') {
        return this.toCommandChildren();
      } else if (this.t === 'string') {
        if (this.quote === 'double') {
          return '"' + this.toCommandChildren() + '"';
        } else if (this.quote === 'single') {
          return "'" + this.toCommandChildren() + "'";
        } else {
          return this.toCommandChildren();
        }
      } else if (this.t === 'var') {
        if (this.bracketed) {
          return '${' + this.toCommandChildren() + '}';
        } else {
          return '$' + this.toCommandChildren();
        }
      } else if (this.t === 'interpolate') {
        if (this.backtick) {
          return "`" + this.toCommandChildren() + "`";
        } else {
          return "$(" + this.toCommandChildren() + ")";
        }
      } else if (this.t === 'backslash') {
        if (this.name) {
          return '\\' + this.name;
        } else {
          return '\\' + this.toCommandChildren();
        }
      } else if (this.t === 'wildcard') {
        return this.toCommandChildren();
      } else if (this.t === 'homedir') {
        return this.toCommandChildren();
      } else {
        throw 'unknown type: ' + this.t;
      }
    };
    Node.prototype.toCommandChildren = function() {
      var item, s, _i, _len, _ref;
      if (typeof this.c === 'string') {
        return this.c;
      }
      s = '';
      _ref = this.c;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        item = _ref[_i];
        if (typeof item === 'string') {
          s += item;
        } else {
          s += item.toCommand();
        }
      }
      return s;
    };
    Node.prototype.expander = function(callback, type, expander, parent, tracker) {
      var item, _i, _len, _ref;
      tracker != null ? tracker : tracker = {
        count: 0,
        any: false,
        finished: false,
        callbackCalled: false
      };
      if (!(parent != null) && this.t === type) {
        throw 'Cannot substitute the parent itself (' + this.t + ')';
      }
      if (this.t === type) {
        tracker.count++;
        tracker.any = true;
        expander(this, __bind(function(replacement) {
          tracker.count--;
          parent.substituteChild(this, replacement);
          if (!tracker.count && tracker.finished && !tracker.callbackCalled) {
            tracker.callbackCalled = true;
            return callback();
          }
        }, this));
      } else if (typeof this.c !== 'string') {
        _ref = this.c;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          item = _ref[_i];
          if (typeof item !== 'string') {
            item.expander(callback, type, expander, this, tracker);
          }
        }
      }
      if (!(parent != null)) {
        tracker.finished = true;
        if (!tracker.any) {
          return callback();
        } else if (!tracker.count && !tracker.callbackCalled) {
          tracker.callbackCalled = true;
          return callback();
        }
      }
    };
    Node.prototype.substituteChild = function(child, replacement) {
      var item, newC, _i, _len, _ref;
      newC = [];
      if (typeof this.c === 'string') {
        this.c = [this.c];
      }
      _ref = this.c;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        item = _ref[_i];
        if (item === child) {
          item = replacement;
        }
        newC.push(item);
      }
      return this.c = newC;
    };
    Node.prototype.toArgs = function(callback, homedirs, vars, interpolator, wildcarder) {
      if (homedirs != null) {
        this.expander((__bind(function() {
          return this.toArgs(callback, null, vars, interpolator, wildcarder);
        }, this)), 'homedir', homedirs);
        return;
      }
      if (vars != null) {
        this.expander((__bind(function() {
          return this.toArgs(callback, null, null, interpolator, wildcarder);
        }, this)), 'var', vars);
        return;
      }
      if (interpolator != null) {
        this.expander((__bind(function() {
          return this.toArgs(callback, null, null, null, wildcarder);
        }, this)), 'interpolate', interpolator);
        return;
      }
      if (wildcarder != null) {
        this.expander((__bind(function() {
          return this.toArgs(callback, null, null, null, null);
        }, this)), 'wildcard', wildcarder);
        return;
      }
      return callback(this);
    };
    Node.prototype.toArgsNoInterpolate = function(args) {
      var node, _i, _len, _ref;
      args = args || [];
      if (this.t !== 'arg') {
        _ref = this.c;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          node = _ref[_i];
          if (typeof node !== 'string') {
            node.toArgsNoInterpolate(args);
          }
        }
      } else {
        args.push(this.stringContents());
      }
      return args;
    };
    Node.prototype.stringContents = function() {
      var c, s, _i, _len, _ref;
      s = '';
      _ref = this.c;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        c = _ref[_i];
        if (typeof c === 'string') {
          s += c;
        } else {
          s += c.stringContents();
        }
      }
      return s;
    };
    return Node;
  })();
  window.Node = Node;
  Point = (function() {
    function Point(s) {
      this.s = s;
      this.pos = 0;
      this.watchFor = [];
    }
    Point.prototype.watched = function(s) {
      var item, _i, _len, _ref;
      _ref = this.watchFor;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        item = _ref[_i];
        if (item === null) {
          return false;
        }
        if (item === s) {
          return true;
        }
      }
      return false;
    };
    Point.prototype.addWatched = function(s) {
      return this.watchFor.push(s);
    };
    Point.prototype.removeWatched = function(s) {
      if (this.watchFor[this.watchFor.length - 1] === s) {
        return this.watchFor.splice(this.watchFor.length - 1, 1);
      } else {
        throw 'Unexpected removeWatched(' + s + ')';
      }
    };
    Point.prototype.quotestate = function(set) {
      if (set === 'pop') {
        this.quotestates.splice(this.quotestates.length - 1, 1);
      } else if (set !== void 0) {
        this.quotestates.push(set);
        return set;
      }
      if (this.quotestates.length) {
        return this.quotestates[this.quotestates.length - 1];
      } else {
        return null;
      }
    };
    Point.prototype.peek = function() {
      return this.s.charAt(this.pos);
    };
    Point.prototype.peekNext = function() {
      return this.s.charAt(this.pos + 1);
    };
    Point.prototype.advance = function() {
      this.pos += 1;
      return this;
    };
    Point.prototype.atEnd = function() {
      return this.pos >= this.s.length;
    };
    Point.prototype.toString = function() {
      return this.s.substr(0, this.pos) + '(*)' + this.s.substr(this.pos);
    };
    return Point;
  })();
  window.Point = Point;
  window.parse = parse = function(s) {
    var doc, point;
    doc = new Node('span', {
      incomplete: 1
    });
    point = new Point(s);
    _parseArgs(point, doc);
    delete doc.incomplete;
    return doc;
  };
  _parseArgs = function(point, doc) {
    var arg, c, _results;
    _results = [];
    while (true) {
      if (point.atEnd()) {
        return;
      }
      c = point.peek();
      if (c in WHITESPACES) {
        doc.pushString(c);
        point.advance();
      } else if (point.watched(c)) {
        return;
      } else {
        arg = new Node('arg', {
          incomplete: true
        });
        doc.push(arg);
        _parseArg(point, arg, false);
      }
    }
    return _results;
  };
  _parseArg = function(point, arg, quoted) {
    var b, c, checkTilde, i, match, name, newChar, promoteWildcard, rest, s, u, user, v, value, w;
    promoteWildcard = false;
    while (true) {
      if (point.atEnd()) {
        delete arg.incomplete;
        break;
      }
      c = point.peek();
      if (!quoted && c in WHITESPACES) {
        delete arg.incomplete;
        break;
      }
      if (point.watched(c)) {
        delete arg.incomplete;
        break;
      }
      if (!quoted && c === "*") {
        promoteWildcard = true;
      }
      if (!quoted && c === "'") {
        s = new Node('string', {
          quote: "single",
          incomplete: true
        });
        arg.push(s);
        _parseSingleQuote(point.advance(), s);
      } else if (c === '"') {
        if (quoted) {
          delete arg.incomplete;
          point.advance();
          break;
        } else {
          s = new Node('string', {
            quote: "double",
            incomplete: true
          });
          arg.push(s);
          _parseArg(point.advance(), s, true);
        }
      } else if (c === '\\') {
        point.advance();
        quoted = point.peek();
        if (quoted === "") {
          b = new Node('backslash', {
            incomplete: 1
          }, '\\');
          arg.push(b);
          break;
        }
        point.advance();
        if (quoted in BACKSLASH_SPECIAL) {
          newChar = BACKSLASH_SPECIAL[quoted];
          name = quoted;
        } else {
          name = null;
          newChar = quoted;
        }
        b = new Node('backslash', {
          name: name
        }, newChar);
        arg.push(b);
      } else if (c === '$') {
        point.advance();
        c = point.peek();
        if (c === "") {
          arg.pushString(s);
          break;
        } else if (c === '(') {
          i = new Node('interpolate', {
            incomplete: true
          });
          arg.push(i);
          _parseInterpolate(point.advance(), i);
        } else if (c === '{') {
          v = new Node('var', {
            bracketed: true,
            incomplete: true
          });
          arg.push(v);
          _parseVar(point.advance(), v);
        } else {
          v = new Node('var', {
            incomplete: true
          });
          arg.push(v);
          _parseVar(point, v);
        }
      } else if (c === "`") {
        i = new Node('interpolate', {
          backtick: true,
          incomplete: true
        });
        arg.push(i);
        _parseInterpolate(point.advance(), i);
      } else {
        arg.pushString(c);
        point.advance();
      }
    }
    checkTilde = arg;
    if (promoteWildcard) {
      w = new Node('wildcard');
      w.c = arg.c;
      arg.c = [w];
      checkTilde = w;
    }
    if (typeof checkTilde.c === 'string') {
      value = checkTilde.c;
    } else {
      value = checkTilde.c[0];
    }
    if (!quoted && value && typeof value === 'string' && value.charAt(0) === '~') {
      match = /^~([a-z0-9_.-]*)(.*)/.exec(value);
      user = match[1] || null;
      rest = match[2];
      u = new Node('homedir', {
        user: user
      });
      u.c = '~' + (user || '');
      if (typeof checkTilde.c === 'string') {
        checkTilde.c = [u];
        if (rest) {
          return checkTilde.c.push(rest);
        }
      } else {
        checkTilde.c[0] = u;
        if (rest) {
          return checkTilde.c.splice(1, 0, rest);
        }
      }
    }
  };
  _parseInterpolate = function(point, i) {
    var backticked, c;
    backticked = i.backtick;
    if (backticked) {
      point.addWatched('`');
    } else {
      point.addWatched(')');
    }
    _parseArgs(point, i);
    c = point.peek();
    if (c === "") {
      return;
    }
    if (backticked && c === '`') {
      point.removeWatched('`');
      point.advance();
      return delete i.incomplete;
    } else if (!backticked && c === ')') {
      point.removeWatched(')');
      point.advance();
      return delete i.incomplete;
    } else {
      return false;
    }
  };
  _parseVar = function(point, v) {
    var bracketed, c, _results;
    bracketed = v.bracketed;
    _results = [];
    while (true) {
      c = point.peek();
      if (c === "") {
        if (!bracketed) {
          delete v.incomplete;
        }
        break;
      }
      if (bracketed) {
        if (c === '}') {
          point.advance();
          delete v.incomplete;
          break;
        }
      } else {
        if (!/[a-zA-Z0-9_]/.test(c)) {
          delete v.incomplete;
          break;
        }
      }
      v.pushString(c);
      _results.push(point.advance());
    }
    return _results;
  };
  _parseSingleQuote = function(point, s) {
    var c;
    point.addWatched("'");
    while (true) {
      c = point.peek();
      if (c === "") {
        break;
      }
      point.advance();
      if (c === "'") {
        delete s.incomplete;
        break;
      }
      s.pushString(c);
    }
    return point.removeWatched("'");
  };
}).call(this);
