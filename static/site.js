(function() {
  var Command, Console, Persister, dataReceiver, expandFile, expandWildcard, genSym, getHomeDir, processEnv, scroller, splitId;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  window.scroller = scroller = null;
  $(function() {
    var mainConsole;
    if ($('#main-console').length) {
      mainConsole = window.mainConsole = new Console($('#main-console'));
      mainConsole.restore();
      mainConsole.focus();
      $('#main-console').click(function() {
        return mainConsole.focus();
      });
    }
    return $('.file').live('click', expandFile);
  });
  processEnv = null;
  $.ajax({
    url: '/env',
    dataType: 'json',
    success: function(result) {
      return processEnv = result;
    }
  });
  Command = (function() {
    function Command(command, args, cwd, env) {
      this.command = command;
      this.args = args;
      this.cwd = cwd;
      this.env = env;
    }
    Command.prototype.runCommand = function(callbackInfo) {
      var data, nextId;
      if (commandSet.has(this)) {
        nextId = splitId(callbackInfo.id)[1];
        commandSet.run(this, (function(data) {
          return callbackInfo.console.boundReceiver(nextId, data);
        }), callbackInfo.console);
        callbackInfo.console.scroller.reinitialise();
        return callbackInfo.console.scroller.scrollToBottom();
      } else {
        data = {
          callbackId: JSON.stringify(callbackInfo.id || 0),
          callback: callbackInfo.name,
          command: this.command,
          args: JSON.stringify(this.args),
          cwd: this.cwd,
          env: JSON.stringify(this.env)
        };
        return this.sendCommand(data);
      }
    };
    Command.prototype.sendCommand = function(data) {
      var name, params, s;
      s = document.createElement('script');
      s.setAttribute('type', 'text/javascript');
      params = ((function() {
        var _results;
        _results = [];
        for (name in data) {
          _results.push(name + '=' + encodeURIComponent(data[name]));
        }
        return _results;
      })()).join('&');
      s.setAttribute('src', '/call?' + params);
      return document.getElementsByTagName('head')[0].appendChild(s);
    };
    Command.prototype.getOutput = function(callback) {
      var callbackId, data, receiver, stderr, stdout;
      stdout = '';
      stderr = '';
      receiver = function(id, data) {
        if (data.stdout) {
          stdout += data.stdout;
        }
        if (data.stderr) {
          stderr += data.stderr;
        }
        if (data.code != null) {
          delete dataReceiver.receivers[callbackId];
          return callback(stdout, stderr);
        }
      };
      if (commandSet.has(this)) {
        return commandSet.run(this, (function(data) {
          return receiver(null, data);
        }), mainConsole);
      } else {
        callbackId = genSym();
        dataReceiver.receivers[callbackId] = receiver;
        data = {
          callbackId: JSON.stringify(callbackId),
          callback: 'dataReceiver',
          command: this.command,
          args: JSON.stringify(this.args),
          cwd: this.cwd,
          env: JSON.stringify(this.env)
        };
        return this.sendCommand(data);
      }
    };
    return Command;
  })();
  Console = (function() {
    function Console(el) {
      this.el = el;
      this.scroller = null;
      this.callbackId = genSym();
      this.boundReceiver = __bind(function(id, data) {
        return this.dataReceived(id, data);
      }, this);
      dataReceiver.receivers[this.callbackId] = this.boundReceiver;
      $('input.input', this.el).bind('keyup', __bind(function(event) {
        return this.inputKeyup(event);
      }, this));
      this.scroller = $('.scroll-pane', this.el).jScrollPane().data('jsp');
      this.homeCache = {};
      this.history = [];
      this.historySearch = null;
      this.historyPos = null;
      this.persister = new Persister();
      this.persistId = null;
      this.persistRestored = false;
    }
    Console.prototype.persistSoon = function(time) {
      if (time == null) {
        time = 1000;
      }
      if (!(this.persistId != null)) {
        return this.saverId = setTimeout((__bind(function() {
          return this.persist();
        }, this)), time);
      }
    };
    Console.prototype.focus = function() {
      return $('input.input', this.el).focus();
    };
    Console.prototype.write = function(output, type, id) {
      var el;
      if (type == null) {
        type = 'stdout';
      }
      el = $('<span>');
      el.addClass(type);
      el.text(output);
      return this.writeEl(el, id);
    };
    Console.prototype.writeEl = function(el, id) {
      var container;
      if (id) {
        container = $('#' + id, this.el);
      } else {
        container = $('.output', this.el);
      }
      container.append(el);
      this.scroller.reinitialise();
      this.scroller.scrollToBottom();
      return this.persistSoon();
    };
    Console.prototype.cwd = function(dir) {
      var cwdEl, els, newEl;
      if (dir != null) {
        dir = normpath(pathjoin(this.cwd(), dir));
        els = $('.meta .cwd', this.el);
        if (!els.length) {
          newEl = $('<div>cwd: <span class="cwd"></span></div>');
          $('.meta', this.el).append(newEl);
          cwdEl = $('.cwd', newEl)[0];
        } else {
          cwdEl = els[els.length - 1];
        }
        $(cwdEl).text(dir);
        this.persist();
        return dir;
      } else {
        els = $('.meta .cwd', this.el);
        if (!els.length) {
          return '/';
        }
        return $(els[els.length - 1]).text();
      }
    };
    Console.prototype.env = function(name, value) {
      var el, els, n, parent, result, setName, v, _i, _j, _k, _len, _len2, _len3, _results;
      if (typeof name === 'object') {
        $('.meta .envs .setting').remove();
        _results = [];
        for (setName in name) {
          value = name[setName];
          _results.push(this.env(setName, value));
        }
        return _results;
      } else if (value !== void 0) {
        els = $('.meta .envs .setting', this.el);
        if (value === null) {
          for (_i = 0, _len = els.length; _i < _len; _i++) {
            el = els[_i];
            if ($('.name', el).text() === name) {
              el.remove();
              return;
            }
          }
        } else {
          for (_j = 0, _len2 = els.length; _j < _len2; _j++) {
            el = els[_j];
            if ($('.name', el).text() === name) {
              $('.value', el).text(value);
              return;
            }
          }
          parent = $('.meta .envs');
          v = $('<span class="setting"><span class="name"></span>=<span class="value"></span></span>');
          $('.name', v).text(name);
          $('.value', v).text(value);
          parent.append(v);
        }
        this.persist();
        return value;
      } else {
        els = $('.meta .envs .setting', this.el);
        result = {};
        for (_k = 0, _len3 = els.length; _k < _len3; _k++) {
          el = els[_k];
          n = $('.name', el).text();
          v = $('.value', el).text();
          result[n] = v;
        }
        if (name != null) {
          return result[name];
        }
        return result;
      }
    };
    Console.prototype.clearConsole = function() {
      $('.output', this.el).html('');
      this.scroller.reinitialise();
      this.scroller.scrollToBottom();
      return this.persist();
    };
    Console.prototype.inputKeyup = function(event) {
      var inputEl;
      if (event.type !== 'keyup') {
        return;
      }
      if (event.which === 13) {
        this.runInputCommand();
        return false;
      }
      if (event.which === 38) {
        if (!(this.historyPos != null)) {
          this.historyPos = this.history.length;
        }
        this.historyPos--;
        if (this.historyPos < 0) {
          this.historyPos = 0;
        }
        inputEl = $('input.input', this.el);
        inputEl.val(this.history[this.historyPos]);
        return false;
      }
      if (event.which === 40) {
        if (!(this.historyPos != null)) {
          return false;
        }
        this.historyPos++;
        if (this.historyPos > this.history.length) {
          this.historyPos = this.history.length;
        }
        inputEl = $('input.input', this.el);
        inputEl.val(this.history[this.historyPos]);
        return false;
      }
      if (event.which === 82 && event.altKey) {
        return false;
      }
    };
    Console.prototype.commandRegistry = {};
    Console.prototype.runInputCommand = function() {
      var cmd, cmdLine, div, input, inputEl, node, sym;
      inputEl = $('input.input', this.el);
      input = inputEl.val();
      this.history.push(input);
      this.historyPos = null;
      this.historySearch = null;
      inputEl.val('');
      div = $('<div class="incomplete-command-set"></div>');
      sym = 'cmd-output-' + genSym();
      div.attr({
        id: sym
      });
      cmdLine = $('<span class="cmd-line"><span class="cmd"></span> <br />');
      cmd = $('.cmd', cmdLine);
      div.append(cmdLine);
      node = parse(input);
      return node.toArgs((__bind(function(node) {
        var command, display, filter, filters, parts, _i, _len;
        display = node.toCommand();
        cmd.text(display);
        this.writeEl(div);
        parts = node.toArgsNoInterpolate();
        command = new Command(parts[0], parts.slice(1), this.cwd(), this.env());
        this.commandRegistry[sym] = command;
        filters = commandSet.match(command.command, command);
        if (filters.length) {
          for (_i = 0, _len = filters.length; _i < _len; _i++) {
            filter = filters[_i];
            if (filter.changeCommand) {
              filter.changeCommand(command);
            }
          }
        }
        command.runCommand({
          callback: this.boundReceiver,
          id: this.callbackId + '.' + sym,
          name: 'dataReceiver',
          console: this
        });
        return this.persist();
      }, this)), (__bind(function(node, callback) {
        var user;
        user = node.user;
        if (user in this.homeCache) {
          callback(this.homeCache[user]);
          return;
        }
        if (!user) {
          callback(processEnv['HOME']);
          return;
        }
        return getHomeDir((__bind(function(dir) {
          this.homeCache[user] = dir;
          return callback(dir);
        }, this)), user, this.cwd(), this.env());
      }, this)), (__bind(function(node, callback) {
        var name;
        console.log('substituting', node.toCommand());
        name = node.stringContents();
        return callback(this.env(name));
      }, this)), (__bind(function(node, callback) {
        var args, command;
        args = node.toArgsNoInterpolate();
        command = new Command(args[0], args.slice(1), this.cwd(), this.env());
        return command.getOutput(__bind(function(stdout, stderr) {
          if (stderr) {
            this.write(stderr, 'stderr');
          }
          return callback(stdout);
        }, this));
      }, this)), (__bind(function(node, callback) {
        var pattern;
        console.log('wildcarding', node.toCommand());
        pattern = node.stringContents();
        return expandWildcard((function(doc) {
          return callback(doc);
        }), pattern, this.cwd(), this.env());
      }, this)));
    };
    Console.prototype.persist = function() {
      var p;
      if (!this.persistRestored) {
        return;
      }
      if (this.persistId) {
        cancelTimeout(this.persistId);
        this.persistId = null;
      }
      p = this.persister;
      p.save('html', $('.output', this.el).html());
      p.save('history', this.history);
      p.save('cwd', this.cwd());
      p.save('env', this.env());
      return p.save('genSym', genSym.counter);
    };
    Console.prototype.restore = function() {
      var c, p;
      p = this.persister;
      $('.output', this.el).html(p.get('html', ''));
      this.history = p.get('history', []);
      this.cwd(p.get('cwd', '/'));
      this.env(p.get('env', {}));
      this.scroller.reinitialise();
      this.scroller.scrollToBottom();
      this.persistRestored = true;
      c = p.get('genSym', 0);
      if (c > genSym.counter) {
        return genSym.counter = c;
      }
    };
    Console.prototype.dataReceived = function(id, data) {
      var cls, command, el, filter, filters, matched, title, _i, _len;
      console.log('data', id, data);
      command = this.commandRegistry[id];
      if (command) {
        filters = commandSet.match(command.command, command);
      } else {
        filters = [];
      }
      if ((data.stdout != null) || (data.stderr != null)) {
        if (data.stdout != null) {
          cls = 'stdout';
        } else {
          cls = 'stderr';
        }
        matched = false;
        if (filters.length) {
          for (_i = 0, _len = filters.length; _i < _len; _i++) {
            filter = filters[_i];
            if (data.stdout && filter.filterStdout) {
              filter.filterStdout((__bind(function(el) {
                return this.writeEl(el, id);
              }, this)), command, data.stdout);
              matched = true;
              break;
            }
            if (data.stderr && filter.filterStderr) {
              filter.filterStderr((__bind(function(el) {
                return this.writeEl(el);
              }, this)), command, data.stderr);
              matched = true;
              break;
            }
          }
        }
        if (!matched) {
          this.write(data.stdout || data.stderr, cls, id);
        }
      }
      if ((data.code != null) && id) {
        el = $('#' + id, this.el);
        el.removeClass('incomplete-command-set');
        el.addClass('command-set');
        el = $('.cmd', el);
        if ((el.attr('title') || '').search(/pid/) !== -1) {
          title = el.attr('title');
          title = title.replace(/pid\:\s*\d+\s*/, '');
          el.attr('title', title);
        }
        this.persistSoon();
      }
      if ((data.pid != null) && id) {
        el = $('.cmd', $('#' + id, this.el));
        return el.attr({
          title: 'pid: ' + data.pid + ' ' + el.attr('title')
        });
      }
    };
    return Console;
  })();
  expandWildcard = function(callback, pattern, cwd, env) {
    var base, command, pat, wildcard, _ref;
    base = pattern;
    wildcard = '';
    while (true) {
      if (base.indexOf('*') !== -1) {
        _ref = splitpath(base), base = _ref[0], pat = _ref[1];
        if (wildcard) {
          wildcard = pat + '/' + wildcard;
        } else {
          wildcard = pat;
        }
      } else {
        break;
      }
    }
    base || (base = '.');
    console.log('wildcarding', base, wildcard);
    command = new Command('find', [base, '-maxdepth', '1', '-wholename', wildcard, '-print0'], cwd, env);
    return command.getOutput((function(stdout, stderr) {
      var doc, file, files, _i, _len;
      files = stdout.split('\u0000');
      doc = new Node('span');
      for (_i = 0, _len = files.length; _i < _len; _i++) {
        file = files[_i];
        if (file.substr(0, 2) === './') {
          file = file.substr(2);
        }
        doc.push(new Node('arg', null, file));
        doc.push(' ');
      }
      return callback(doc);
    }));
  };
  getHomeDir = function(callback, user, cwd, env) {
    var command;
    command = new Command('python', ['-c', 'import pwd, sys; print pwd.getpwnam(sys.argv[1]).pw_dir', user], cwd, env);
    return command.getOutput((function(stdout, stderr) {
      return callback(stdout);
    }));
  };
  genSym = function() {
    return 'sym' + (++arguments.callee.counter);
  };
  genSym.counter = 0;
  window.dataReceiver = dataReceiver = function(id, data) {
    var curId, nextId, receiver, _ref;
    _ref = splitId(id), curId = _ref[0], nextId = _ref[1];
    receiver = arguments.callee.receivers[curId];
    return receiver(nextId, data);
  };
  splitId = function(id) {
    if (id.indexOf('.') !== -1) {
      return [id.substr(0, id.indexOf('.')), id.substr(id.indexOf('.') + 1)];
    } else {
      return [id, null];
    }
  };
  dataReceiver.receivers = {};
  Persister = (function() {
    function Persister(storage) {
      if (!(storage != null)) {
        storage = window.localStorage;
      }
      this.storage = storage;
    }
    Persister.prototype.save = function(key, value) {
      var v;
      if (v === null) {
        return this.storage.removeItem(key);
      } else {
        v = JSON.stringify(value);
        return this.storage.setItem(key, v);
      }
    };
    Persister.prototype.get = function(key, defaultValue) {
      var v;
      if (defaultValue == null) {
        defaultValue = null;
      }
      v = this.storage.getItem(key);
      if (v != null) {
        return JSON.parse(v);
      } else {
        return defaultValue;
      }
    };
    return Persister;
  })();
  expandFile = function(event) {
    return $(event.target).css({
      "background-color": "#f00"
    });
  };
}).call(this);
