window.pathjoin = pathjoin = (base, path, paths...) ->
  if /^\//.test(path)
    rest = path
  else if /\/$/.test(base)
    rest = base + path
  else
    rest = base + '/' + path
  if paths.length
    return pathjoin(rest, paths...)
  else
    return rest

window.normpath = normpath = (path) ->
  if not /\/$/.test(path)
    path = path + '/'
  path = path.replace(/\/\/+/g, '/')
  path = path.replace(/\/\.(?=\/)/g, '')
  path = path.replace(/\/([^/]+)\/\.\.(?=\/)/g, '')
  loop
    newPath = path.replace(/^\/..(?=\/)/g, '')
    if newPath == path
      break
    path = newPath
  if path != '/'
    path = path.substr(0, path.length-1)
  return path

window.splitpath = splitpath = (path) ->
  match = /^(.*)\/(^[/]+)$/.exec(path)
  if not match
    return ['', path]
  return [match[1], match[2]]
