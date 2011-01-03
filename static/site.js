(function() {
  var Command, Console, dataReceiver, expandWildcard, genSym, getHomeDir, processEnv, scroller;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  window.scroller = scroller = null;
  $(function() {
    var mainConsole;
    if ($('#main-console').length) {
      mainConsole = window.mainConsole = new Console($('#main-console'));
      return mainConsole.focus();
    }
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
      var data;
      if (commandSet.has(this)) {
        commandSet.run(this, (function(data) {
          return callbackInfo.console.boundReceiver(null, data);
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
    }
    Console.prototype.focus = function() {
      return $('input.input', this.el).focus();
    };
    Console.prototype.write = function(output, type) {
      var el;
      if (type == null) {
        type = 'stdout';
      }
      el = $('<span>');
      el.addClass(type);
      el.text(output);
      return this.writeEl(el);
    };
    Console.prototype.writeEl = function(el) {
      $('.output', this.el).append(el);
      this.scroller.reinitialise();
      return this.scroller.scrollToBottom();
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
      var el, els, n, parent, result, v, _i, _j, _k, _len, _len2, _len3;
      if (value !== void 0) {
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
    Console.prototype.inputKeyup = function(event) {
      if (event.type !== 'keyup') {
        return;
      }
      if (event.which === 13) {
        this.runInputCommand();
        return false;
      }
    };
    Console.prototype.runInputCommand = function() {
      var cmd, cmdLine, input, inputEl, node;
      inputEl = $('input.input', this.el);
      input = inputEl.val();
      inputEl.val('');
      cmdLine = $('<span class="cmd-line incomplete"><span class="prompt">$</prompt> <span class="cmd"></span> <br />');
      cmd = $('.cmd', cmdLine);
      node = parse(input);
      return node.toArgs((__bind(function(node) {
        var command, display, parts;
        display = node.toCommand() + ' ' + node.toXML();
        cmd.text(display);
        this.writeEl(cmdLine);
        parts = node.toArgsNoInterpolate();
        command = new Command(parts[0], parts.slice(1), this.cwd(), this.env());
        return command.runCommand({
          callback: this.boundReceiver,
          id: this.callbackId,
          name: 'dataReceiver',
          console: this
        });
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
    Console.prototype.dataReceived = function(id, data) {
      var cls;
      if (data.stdout || data.stderr) {
        if (data.stdout != null) {
          cls = 'stdout';
        } else {
          cls = 'stderr';
        }
        return this.write(data.stdout || data.stderr, cls);
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
      console.log('result', stdout, files);
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
    var curId, nextId, receiver;
    if (id.indexOf('.') !== -1) {
      curId = id.substr(0, id.indexOf('.'));
      nextId = id.substr(id.indexOf('.') + 1);
    } else {
      curId = id;
      nextId = null;
    }
    receiver = arguments.callee.receivers[id];
    return receiver(nextId, data);
  };
  dataReceiver.receivers = {};
}).call(this);
