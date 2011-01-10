class CommandSet

  constructor: ->
    this.commands = {}
    this.filters = {}

  has: (command) ->
    if typeof command != 'string'
      command = command.command
    if not command?
      command = ''
    return command of this.commands

  run: (command, outputer, console) ->
    c = this.commands[command.command || '']
    result = c(command, outputer, console)
    result ||= 0
    ## FIXME: id?
    console.dataReceived(null, {code: result})

  add: (name, func) ->
    this.commands[name] = func

  addFilter: (name, matchFunc, obj) ->
    if not (name of this.filters)
      this.filters[name] = []
    this.filters[name].push([matchFunc, obj])

  match: (name, thing) ->
    result = []
    for matchName in [name, '*']
      if this.filters[matchName]
        for [matchFunc, obj] in this.filters[matchName]
          if (not matchFunc?) or matchFunc(thing)
            result.push(obj)
    return result

window.commandSet = commandSet = new CommandSet()

commandSet.add 'cd', (command, outputer, console) ->
  if not command.args.length or '-h' in command.args
    outputer(stdout: "Usage: cd DIR")
    return if '-h' in command.args then 0 else 1
  console.cwd(command.args[0])
  outputer(code: 0)

commandSet.add 'setenv', (command, outputer, console) ->
  if not command.args.length
    env = command.env
    keys = (key for key of env)
    keys.sort()
    for key in keys
      outputer(stdout: key + '=' + env[key] + '\n')
    outputer(code: 0)
    return
  if command.args.length == 1
    value = command.env[command.args[0]]
    if value?
      outputer(stdout: command.args[0] + '=' + value + '\n')
    else
      outputer(stdout: command.args[0] + ' no value\n')
    outputer(code: 0)
    return
  if '-h' in command.args
    outputer(stdout: "Usage: setenv NAME VALUE")
    outputer(code: 0)
    return
  console.env(command.args[0], command.args[1])
  outputer(code: 0)

commandSet.add 'clear', (command, outputer, console) ->
  console.clearConsole()
  outputer(code: 0)

commandSet.add '', (command, outputer, console) ->
  outputer(code: 0)


commandSet.addFilter 'ls', null, {
    complete: false,
    filterStdout: (callback, command, data) ->
      lines = data.split(/\n/)
      for line in lines
        if not line
          continue
        result = $('<span class="file"></span>')
        parts = parseLs(line)
        result.attr(parts)
        result.text(parts.filename)
        callback(result)
        callback($('<br>'))
    changeCommand: (command) ->
      command.args.push('-l')
  }

getMatch = (regex, line) ->
  m = regex.exec(line)
  if m
    rest = line.substr(m.index + m[0].length)
    rest = rest.replace(/^\s+/, '')
    return [m[0], rest]
  else
    return [null, line]

parseLs = (line) ->
  results = {}
  [results.perms, rest] = getMatch(/[drwx-]+/, line)
  [huh, rest] = getMatch(/\d+/, rest)
  [results.user, rest] = getMatch(/[a-zA-Z][a-zA-Z0-9_-]*/, rest)
  [results.group, rest] = getMatch(/[a-zA-Z][a-zA-Z0-9_-]*/, rest)
  [results.size, rest] = getMatch(/[0-9]+[MKG]?/, rest)
  [results.date, rest] = getMatch(/\d\d\d\d-\d\d-\d\d/, rest)
  [results.time, rest] = getMatch(/\d\d:\d\d/, rest)
  if rest.search(/->/) != -1
    m = /^(.*)\s+->\s+(.*)$/.exec(rest)
    results.symlink = m[1]
    rest = m[2]
  results.filename = rest
  return results

