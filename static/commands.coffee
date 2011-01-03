commands = window.commands = {}

class CommandSet

  constructor: ->
    this.commands = {}
    this.filters = {}

  has: (command) ->
    if typeof command != 'string'
      command = command.command
    return command of this.commands

  run: (command, outputer, console) ->
    c = this.commands[command.command]
    result = c(command, outputer, console)
    result ||= 0
    ## FIXME: id?
    console.dataReceived(null, {code: result})

  add: (name, func) ->
    this.commands[name] = func

  addFilter: (type, name, matchFunc, obj) ->
    if not (type of this.filters)
      this.filters[type] = {}
    if not (name of this.filters[type])
      this.filters[type][name] = []
    this.filters[type][name].push([matchFunc, obj])

  match: (type, name, thing) ->
    result = []
    for matchName in [name, '*']
      if this.filters[type][matchName]
        for matchFunc, obj in this.filters[type][matchName]
          if not matchFunc or matchFunc(thing)
            result.push(obj)
    return result

window.commandSet = commandSet = new CommandSet()

commandSet.add 'cd', (command, outputer, console) ->
  if not command.args.length or '-h' in command.args
    outputer(stdout: "Usage: cd DIR")
    return if '-h' in command.args then 0 else 1
  console.cwd(command.args[0])

commandSet.add 'setenv', (command, outputer, console) ->
  if not command.args.length
    env = command.env
    keys = (key for key of env)
    keys.sort()
    for key in keys
      outputer(stdout: key + '=' + env[key] + '\n')
    return
  if command.args.length == 1
    value = command.env[command.args[0]]
    if value?
      outputer(stdout: command.args[0] + '=' + value + '\n')
    else
      outputer(stdout: command.args[0] + ' no value\n')
    return
  if '-h' in command.args
    outputer(stdout: "Usage: setenv NAME VALUE")
    return
  console.env(command.args[0], command.args[1])

commandSet.addFilter 'output', 'ls', null, {
    complete: false,
    filterStdout: (callback, command, data) ->
      lines = data.split(/\n/)
      result = $('<span></span>')
      for line in lines
        a = $('<a></a>')
        a.attr('href', command.cwd + '/' + line)
        a.text(line)
        a.addClass('file')
        result.append(a)
      callback(result)
  }


