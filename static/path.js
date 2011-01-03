(function() {
  var normpath, pathjoin, splitpath;
  var __slice = Array.prototype.slice;
  window.pathjoin = pathjoin = function() {
    var base, path, paths, rest;
    base = arguments[0], path = arguments[1], paths = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
    if (/^\//.test(path)) {
      rest = path;
    } else if (/\/$/.test(base)) {
      rest = base + path;
    } else {
      rest = base + '/' + path;
    }
    if (paths.length) {
      return pathjoin.apply(null, [rest].concat(__slice.call(paths)));
    } else {
      return rest;
    }
  };
  window.normpath = normpath = function(path) {
    var newPath;
    if (!/\/$/.test(path)) {
      path = path + '/';
    }
    path = path.replace(/\/\/+/g, '/');
    path = path.replace(/\/\.(?=\/)/g, '');
    path = path.replace(/\/([^/]+)\/\.\.(?=\/)/g, '');
    while (true) {
      newPath = path.replace(/^\/..(?=\/)/g, '');
      if (newPath === path) {
        break;
      }
      path = newPath;
    }
    if (path !== '/') {
      path = path.substr(0, path.length - 1);
    }
    return path;
  };
  window.splitpath = splitpath = function(path) {
    var match;
    match = /^(.*)\/(^[/]+)$/.exec(path);
    if (!match) {
      return ['', path];
    }
    return [match[1], match[2]];
  };
}).call(this);
