(function() {
  var CommandSet, commandSet, commands;
  var __indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (this[i] === item) return i;
    }
    return -1;
  };
  commands = window.commands = {};
  CommandSet = (function() {
    function CommandSet() {
      this.commands = {};
      this.filters = {};
    }
    CommandSet.prototype.has = function(command) {
      if (typeof command !== 'string') {
        command = command.command;
      }
      return command in this.commands;
    };
    CommandSet.prototype.run = function(command, outputer, console) {
      var c, result;
      c = this.commands[command.command];
      result = c(command, outputer, console);
      result || (result = 0);
      return console.dataReceived(null, {
        code: result
      });
    };
    CommandSet.prototype.add = function(name, func) {
      return this.commands[name] = func;
    };
    CommandSet.prototype.addFilter = function(type, name, matchFunc, obj) {
      if (!(type in this.filters)) {
        this.filters[type] = {};
      }
      if (!(name in this.filters[type])) {
        this.filters[type][name] = [];
      }
      return this.filters[type][name].push([matchFunc, obj]);
    };
    CommandSet.prototype.match = function(type, name, thing) {
      var matchFunc, matchName, obj, result, _i, _len, _len2, _ref, _ref2;
      result = [];
      _ref = [name, '*'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        matchName = _ref[_i];
        if (this.filters[type][matchName]) {
          _ref2 = this.filters[type][matchName];
          for (obj = 0, _len2 = _ref2.length; obj < _len2; obj++) {
            matchFunc = _ref2[obj];
            if (!matchFunc || matchFunc(thing)) {
              result.push(obj);
            }
          }
        }
      }
      return result;
    };
    return CommandSet;
  })();
  window.commandSet = commandSet = new CommandSet();
  commandSet.add('cd', function(command, outputer, console) {
    if (!command.args.length || __indexOf.call(command.args, '-h') >= 0) {
      outputer({
        stdout: "Usage: cd DIR"
      });
      if (__indexOf.call(command.args, '-h') >= 0) {
        return 0;
      } else {
        return 1;
      }
    }
    return console.cwd(command.args[0]);
  });
  commandSet.add('setenv', function(command, outputer, console) {
    var env, key, keys, value, _i, _len;
    if (!command.args.length) {
      env = command.env;
      keys = (function() {
        var _results;
        _results = [];
        for (key in env) {
          _results.push(key);
        }
        return _results;
      })();
      keys.sort();
      for (_i = 0, _len = keys.length; _i < _len; _i++) {
        key = keys[_i];
        outputer({
          stdout: key + '=' + env[key] + '\n'
        });
      }
      return;
    }
    if (command.args.length === 1) {
      value = command.env[command.args[0]];
      if (value != null) {
        outputer({
          stdout: command.args[0] + '=' + value + '\n'
        });
      } else {
        outputer({
          stdout: command.args[0] + ' no value\n'
        });
      }
      return;
    }
    if (__indexOf.call(command.args, '-h') >= 0) {
      outputer({
        stdout: "Usage: setenv NAME VALUE"
      });
      return;
    }
    return console.env(command.args[0], command.args[1]);
  });
  commandSet.addFilter('output', 'ls', null, {
    complete: false,
    filterStdout: function(callback, command, data) {
      var a, line, lines, result, _i, _len;
      lines = data.split(/\n/);
      result = $('<span></span>');
      for (_i = 0, _len = lines.length; _i < _len; _i++) {
        line = lines[_i];
        a = $('<a></a>');
        a.attr('href', command.cwd + '/' + line);
        a.text(line);
        a.addClass('file');
        result.append(a);
      }
      return callback(result);
    }
  });
}).call(this);
