'use strict'

// get global socket
var socket = io();

// cache for copying files
// object of type { name: id }
var copyCache = {};

// for jquery: execute when the document is ready to be processed
$(document).ready(function() {
  // subtract scrollbar width to header
  var offset = scrollbarWidth();
  // do the first resize on page load
  $('.scrollbar-spacer').width($('.scrollbar-spacer').width() - offset);

  // fix panel header size on resize
  $(window).resize(function() {
    // set spacer to 100%
    $('.scrollbar-spacer').css('width', '100%');

    // resize to contain scrollbar
    $('.scrollbar-spacer').width($('.scrollbar-spacer').width() - offset);
  });

  // resize buttons when poweroff is active
  poweroffActive();

  // tie every button with its function
  helpButton();
  copyButton();
  dirButton();
  delButton();

  // when pathbar is clicked, refresh panel
  refreshPathBar();

  // files requested
  socket.on('files', function(data) {
    if (typeof data.files == 'string') {
      error(data.files);
    } else {
      populatePanel(data.files, data.panel);
      pathBar(data.pathbar, data.panel);
      // if panel is right, set freespace
      if (data.panel == 'right') {
        freeSpace(data.free);
      }
    }

    // tie every folder link to a websocket emit event
    dirLinks();

    // highlight selected files on click
    highlightFiles();
  });

  socket.on('watch', function(data) {
    if (data.path == getPath('left')) {
      socket.emit('ls', {
        path: data.path,
        panel: 'left'
      });
    }
  });

  // create dir/delete requested
  socket.on('result', function(data) {
    // display message
    if (data.message !== undefined) {
      error(data.message);
    }

    // refresh view on panel returned and
    // on other side panel if it has the same path
    socket.emit('ls', {
      path: data.path,
      panel: data.panel
    });
    var otherPanel = data.panel == 'left'? 'right' : 'left';
    var otherPathbar = getPath(otherPanel);
    if (data.path == otherPathbar) {
      socket.emit('ls', {
        path: otherPathbar,
        panel: otherPanel
      });
    }
  });

  // copy requested
  socket.on('cp-progress', function(data) {
    // insert progressbar name (tied to filename) into cache
    // if present use the one present
    var idEnc;
    if (copyCache.hasOwnProperty(data.name)) {
      idEnc = copyCache[data.name];
    } else {
      idEnc = 'copy-' + getRandomInt(1, 9999);
      copyCache[data.name] = idEnc;
    }

    // if progressbar exists, update it, else create it
    // same for elapsed time and speed
    if ($('#' + idEnc).length) {
      $('#' + idEnc).attr('value', data.percent);
      $('#' + idEnc + '-eta').html(data.eta);
      $('#' + idEnc + '-sp').html(data.speed);
    } else {
      $('#copy-prog').append(
        '<label style="display: block; float: left; clear: right;" for="' +
          idEnc + '">' + t(data.name) + '</label>' +
        '<span style="display: block; float: right; clear: left;"">' +
          '<span id="' + idEnc + '-eta">' + data.eta + '</span> | ' +
          '<span id="' + idEnc + '-sp">' + data.speed + '</span></span>' +
        '<br style="margin-bottom: 10px;" />\n' +
        '<progress id="' + idEnc + '" name="' + idEnc + '" ' +
          'value="' + data.percent + '" max="100" style="width: 400px;">' +
          '</progress>\n'
      );
    }

    // open lightbox if not already open
    if ($.featherlight.current() === null) {
      // show lightbox
      var content = $.featherlight('#copy-box', {
        closeTrigger: null,
        closeOnClick: false,
        closeOnEsc: false,
        closeIcon: '',
        persist: true,
        afterClose: function(event) {
          // append to body again
          $('body').append(content.$content);
        }
      });
    }
  });

  socket.on('cp-status', function(data) {
    // decrement number of copied files in copy cache
    copyCache['__num'] -= 1;

    // retrieve id name into copy cache
    var idEnc = copyCache[data.name];

    if (data.status == 'error') {
      // if error set progressbar to 0
      $('#' + idEnc).attr('value', 0);
    } else if (data.status == 'copied') {
      // if success set progressbar to 100
      $('#' + idEnc).attr('value', 100);
    }

    // append status to copy-status
    $('#copy-status').append(data.message);

    // add button to close if number of copied files in copy cache is 0
    if (copyCache['__num'] == 0) {
      $('#copy-box').append(
        '<button id="copy-close" style="display: block; float: right;" ' +
          'name="copy-close">Close</button>'
      );
      $('#copy-close').click(function(event) {
        event.preventDefault();

        // close lightbox
        $.featherlight.current().close();
      });
    }
  });

  // ask when closing window
  askClose();
});

/***************
 * POSITIONING *
 ***************/

/**
 * Calculate current browser scrollbar width.
 */
function scrollbarWidth() {
  // create a scrollable div outside view
  var scrollDiv = bodyElem({
    el: 'div',
    cls: 'scrollbar-measure'
  });

  // calculate scrollbar width
  var width = scrollDiv.offsetWidth - scrollDiv.clientWidth;

  // delete created div
  $(scrollDiv).remove();

  return width;
}

/**
 * Resize other buttons when poweroff is active.
 */
function poweroffActive() {
  if (document.getElementById('poweroff-button')) {
    $('#buttons-wrapper').addClass('poweroff-buttons-wrapper');
  }
}

/**
 * Highlight/dehighlight clicked files on the same panel (else switch panel).
 */
function highlightFiles() {
  $('.name').each(function() {
    $(this).unbind('click').click(function(event) {
      // check that really only span its clicked
      if ($(event.target).is('span')) {
        event.preventDefault();

        // current file div
        var fileParent = $(this).parent();
        // current file panel
        var currPanel = fileParent.parent().attr('id');

        // if it is hilighted, click remove hilight
        if (fileParent.hasClass('selected')) {
          fileParent.removeClass('selected');
        } else {
          // not hilighted

          // get eventual hilighted item
          var lastPanel = $('.selected').first().parent().attr('id');

          // if anything hilighted is on different panel, dehilight all on that
          // panel
          if (currPanel != lastPanel) {
            $('#' + lastPanel + ' > div').removeClass('selected');
          }

          // hilight clicked file (if not ..)
          if ($(this).first().text() != '..') {
            fileParent.addClass('selected');
          }
        }
      }
    });
  });
}

/***********
 * BUTTONS *
 ***********/

/**
 * Make the help button display an help box overlay.
 */
function helpButton() {
  $('#help-box').load('help.html', function(res, status, xhr) {
    // add close button
    $('#help-box').append('<button id="help-close" style="display: block; ' +
      'float: right;" name="help-close">Close</button>');

    // click event of close button
    $('#help-close').click(function(event) {
      event.preventDefault();

      // close lightbox
      $.featherlight.current().close();
    });
  });

  $('#help-button').click(function(event) {
    event.preventDefault();

    var content = $.featherlight('#help-box', {
      closeTrigger: null,
      closeOnClick: false,
      closeOnEsc: false,
      closeIcon: '',
      persist: true,
      afterClose: function(event) {
        // append to body again
        $('body').append(content.$content);
      }
    });
  });
}

/**
 * Make the copy button display a form for chosing where to copy
 */
function copyButton() {
  $('#copy-button').click(function(event) {
    event.preventDefault();

    $('#copy-box').html(
      '<div id="copy-prog" style="width: 400px;">\n' +
      '</div>\n' +
      '<div id="copy-status" style="width: 400px;">\n' +
      '  <p style="text-align: center; font-width: 1.2rem; font-weight: bold;">' +
      'Status</p>\n' +
      '</div>'
    );

    // clear copy cache
    copyCache = {};

    // gather all selected items
    var selected = [];
    $('.selected > span > a').each(function() {
      selected.push(
        // path is path of file (which is base64 encoded)
        atob(decodeURIComponent($.url('?path', this.href)))
      );
    });

    if (selected.length > 0) {
      // something is selected

      // save number of selected into copy cache
      copyCache['__num'] = selected.length;

      // retrieve panel and prefix
      var panelSrc = $.url('?panel', $('.selected > span > a')
        .first()
        .attr('href'));
      var panelDst = panelSrc == 'left'? 'right' : 'left';
      var prefixSrc = getPath(panelSrc);
      var prefixDst = getPath(panelDst);

      socket.emit('cp', {
        names: selected,
        panelSrc: panelSrc,
        prefixSrc: prefixSrc,
        panelDst: panelDst,
        prefixDst: prefixDst
      });
    } else {
      // nothing is selected
      error('Nothing is selected');
    }
  });
}

/**
 * Make the dir button display a form for chosing new filename
 */
function dirButton() {
  // create form to ask for panel and dir name
  $('#create-box').html(
    '<form id="create-dir">\n' +
    '  <label for="panel">Panel:</label><br style="margin-bottom: 10px;" />\n' +
    '  <input type="radio" name="panel" value="left" checked /> Left<br />\n' +
    '  <input type="radio" name="panel" value="right" /> Right<br />\n' +
    '  <br />\n' +
    '  <label for="dir">Name:</label>\n' +
    '  <input id="create-name" type="text" name="name" ' +
        'placeholder="new-dir" />\n' +
    '  <br style="margin-bottom: 20px;"/>\n' +
    '  <input id="create-cancel" style="display: block; float: left;" ' +
        'type="reset" name="cancel" value="Close" />\n' +
    '  <input id="create-ok" style="display: block; float: right;" ' +
        'type="submit" name="ok" value="Create" disabled="disabled" />\n' +
    '</form>\n'
  );

  $('#create-button').click(function(event) {
    event.preventDefault();

    var content = $.featherlight('#create-box', {
      closeTrigger: null,
      closeOnClick: false,
      closeOnEsc: false,
      closeIcon: '',
      persist: true,
      afterClose: function(event) {
        // append to body again
        $('body').append(content.$content);
      }
    });
  });

  // enable submit only if name is filled
  $('#create-name').keyup(function() {
    if ($(this).val() == '') {
      $('#create-ok').attr('disabled', 'disabled');
    } else {
      $('#create-ok').removeAttr('disabled');
    }
  });

  $('#create-dir').unbind('submit').submit(function(event) {
    event.preventDefault();

    // create an object reading from a form
    var values = {};
    $.each($('#create-dir').serializeArray(), function(i, field) {
      values[field.name] = field.value;
    });
    values.path = getPath(values.panel);

    // reset form
    $(':input').not(':button, :submit, :reset, :hidden')
      .removeAttr('selected')
      .not(':checkbox, :radio, select')
      .val('');

    socket.emit('mkdir', values);

    // close lightbox
    $.featherlight.current().close();
  });

  // click event of close button
  $('#create-cancel').click(function(event) {
    // close lightbox
    $.featherlight.current().close();
  });
}

/**
 * Make the delete button display a confirm message and delete file
 */
function delButton() {
  $('#delete-box').html(
    '<p>Are you REALLY sure you want to delete these files?<p>' +
    '<button id="delete-cancel" name="delete-cancel" ' +
    'style="display: block; float: left;">Cancel</button>' +
    '<button id="delete-ok" name="delete-ok" ' +
    'style="display: block; float: right;">I\'m sure</button>'
  );

  $('#delete-button').click(function(event) {
    event.preventDefault();

    // gather all selected items
    var selected = [];
    $('.selected > span > a').each(function() {
      selected.push(
        // path is path of file (which is base64 encoded)
        atob(decodeURIComponent($.url('?path', this.href)))
      );
    });

    if (selected.length > 0) {
      // something is selected

      // ask if sure: fullfill delete-box and display it
      var content = $.featherlight('#delete-box', {
        persist: true,
        afterClose: function(event) {
          // append to body again
          $('body').append(content.$content);
        }
      });

      $('#delete-ok').unbind('click').click(function(event) {
        // close lightbox
        $.featherlight.current().close();

        // retrieve panel and prefix
        var panel = $.url('?panel', $('.selected > span > a')
          .first()
          .attr('href'));
        var prefix = getPath(panel);

        socket.emit('rm', {
          names: selected,
          panel: panel,
          prefix: prefix
        });
      });

      $('#delete-cancel').unbind('click').click(function(event) {
        // close lightbox
        $.featherlight.current().close();
      });
    } else {
      // nothing is selected
      error('Nothing is selected');
    }

  });
}

function offButton(url) {
  window.open(url, '_blank');
}

/*****************
 * COMMUNICATION *
 *****************/

/**
 * Ask if user really wants to close application.
 */
function askClose() {
  var unloadEvent = window.attachEvent || window.addEventListener;
  var trigger = window.attachEvent? 'onbeforeunload' : 'beforeunload';

  unloadEvent(trigger, function(event) {
    var confirmationMessage = 'Do you REALLY want to close application? ' +
      'If there is an operation pending, it will be ABORTED.';

    (event || window.event).returnValue = confirmationMessage;
    return confirmationMessage;
  });
}

/**
 * Displays a lightbox with an error message.
 * (no error check)
 *
 * < message: string to display
 */
function error(message) {
  $('#error-box').html(
    '<p>' + message + '</p>' +
    '<button id="error-close" style="display: block; ' +
      'float: right;" name="error-close">Close</button>'
  );

  var content = $.featherlight('#error-box', {
    closeTrigger: null,
    closeOnClick: false,
    closeOnEsc: false,
    closeIcon: '',
    persist: true,
    afterClose: function(event) {
      // append to body again
      $('body').append(content.$content);
    }
  });

  $('#error-close').click(function(event) {
    event.preventDefault();

    // close lightbox
    $.featherlight.current().close();
  });
}

/**
 * Retrieve all links under the panels, inhibit them and target them to
 * WebSockets.
 */
function dirLinks() {
  $('#left a, #right a').each(function () {
    $(this).unbind('click').click(function (event) {
      // disable default event
      event.preventDefault();

      // we need to get path, so first we urldecode
      // then we unmap: base64 to normal string
      var path = atob(decodeURIComponent($.url('?path', this.href)));
      var panel = $.url('?panel', this.href);

      // bind to websocket
      socket.emit('ls', {
        path: path || '/',
        panel: panel
      });
    });
  });
}

/**
 * Populate a panel with files.
 *
 * < files: files metadata
 * < panel: 'left' or 'right'
 */
function populatePanel(files, panel) {
  var panelId = '#' + panel;

  // clear current files
  $(panelId).empty();

  function createFile(i, path, name, type, user, perms) {
    var file = '<div id="r-file-' + i + '">' +
      '<span class="name">' +
      '<a href="/?path=' + encodeURIComponent(btoa(path)) +
      '&panel=' + panel + '" ';


    // if dir insert a link else not
    if (type == 'dir') {
      // btoa because critical characters get mapped to uncritical characters
      // then the whole path is urlencoded
      file += '>' + t(name, 68) + '</a>'
    } else {
      file += 'class="disabled">' + t(name, 68) + '</a>'
    }

    file +=  '</span>' +
      '<span class="type">' + type + '</span>' +
      '<span class="user">' + t(user, 9, false) + '</span>' +
      '<span class="perms">' + perms + '</span></div>';

    return file;
  }

  files.forEach(function(elem, i, array) {
    $(panelId).append(createFile(i, elem.path, elem.name, elem.type, elem.user,
      elem.perms));
  });
}

/**
 * Set specified panel pathbar to path.
 *
 * < path: path to set
 * < panel: panel where to set path
 */
function pathBar(path, panel) {
  var truncPath;
  if (panel == 'left') {
    truncPath = t(path, 88);
  } else {
    truncPath = t(path, 68);
  }

  $('#' + panel + '-path').html(
    '<a href="/?path=' + encodeURIComponent(btoa(path)) + '" ' +
      'class="disabled2">' + truncPath + '</a>'
  );
}

/**
 * Refresh selected panel, when pathbar is clicked.
 */
function refreshPathBar() {
  $('#left-path, #right-path').each(function() {
    $(this).unbind('click').click(function(event) {
      // disable default event
      event.preventDefault();

      var id = $(this).attr('id');
      // check in what panel we are
      var panel = id == 'left-path'? 'left' : 'right';
      var path = getPath(panel);

      // bind to websocket
      socket.emit('ls', {
        path: path,
        panel: panel
      });
    });
  });
}

/**
 * Set freespace to specified value.
 *
 * < value: value to set
 */
function freeSpace(value) {
  $('#freespace').html(value);
}

/*********
 * UTILS *
 *********/

/**
 * Given a string, if its less than maxLen no operation is done, else
 * it is traling cut to maxLen char and '...' appended.
 *
 * < str: a string
 * < maxLen: length of output string - 3 (default 25)
 *
 * > str or '...' + str
 */
function t(str, maxLen, dots) {
  if (maxLen === undefined) {
    maxLen = 37;
  }

  if (dots === undefined) {
    dots = true;
  }

  // if not a string
  if (typeof str != 'string') {
    return str;
  }
  var suffix = str.length > maxLen && dots? '...' : '';
  return suffix + str.substring(str.length - maxLen);
}

/**
 * Create a new element and append to body.
 *
 * < elem: element to create
 * < cls: class to give
 *
 * > created element
 */
function bodyElem(params) {
  if (!('el' in params)) {
    throw 'undefined element to append to body';
  }
  var el = document.createElement(params['el']);

  if ('id' in params ) {
    $(el).attr('id', params['id']);
  }

  if ('cls' in params) {
    $(el).attr('class', params['cls']);
  }

  $(el).appendTo('body');
  return el;
}

/**
 * Return path contained in pathbar.
 *
 * < panel: panel to read pathbar from
 *
 * > path in pathbar
 */
function getPath(panel) {
  var href = $('#' + panel + '-path > a').attr('href');
  return atob(decodeURIComponent($.url('?path', href)));
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 *
 * < min: lower bound
 * < max: upper bound
 *
 * > random integer
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
