var help = [
  {
    id: 'A',
    title: 'Left panel',
    descs: [
      'The space marked by letter <strong>A</strong> is called left panel ' +
        'and it is independent from right panel.'
    ]
  },
  {
    id: 'B',
    title: 'Right panel',
    descs: [
      'The space marked by letter <strong>B</strong> is called right panel ' +
        'and it is independent from left panel.'
    ]
  },
  {
    id: 1,
    title: 'Help',
    descs: [
      'If this button is clicked, this help view will be shown.',
      'If you have further questions, write an email to ' +
        '<a href="mailto:info@officinesrl.com">info@officinesrl.com</a>.'
    ]
  },
  {
    id: 2,
    title: 'Copy',
    descs: [
      'When this button is pressed, currently highlighted files or folders ' +
        'on a panel, e.g. left panel, get copied to the other panel, e.g. ' +
        'right panel, in the current folder.',
      'No confirmation is asked and a view with current copy progress and ' +
        'status is shown.'
    ]
  },
  {
    id: 3,
    title: 'New folder',
    descs: [
      'When this button is pressed, the system ask the user for the name of ' +
        'a new folder and for the panel, left or right, in which it will ' +
        'be created.'
    ]
  },
  {
    id: 4,
    title: 'Delete',
    descs: [
      'If this button is pressed, currently highlighted files or folders ' +
        'will be deleted.',
      'A confirmation message is shown, therefore operation can be ' +
        'canceled. After confirmation, delete operation ' +
        '<strong>cannot be undone!</strong>'
    ]
  },
  {
    id: 5,
    title: 'Pathbar',
    descs: [
      'Pathbar will show the current directory displayed by the selected ' +
        'panel.',
      'If this pathbar is clicked current panel is refreshed and newly ' +
        'created files and folders get displayed.'
    ]
  },
  {
    id: 6,
    title: 'Folder link',
    descs: [
      'If currently pointed entry is a folder, a link will be shown.',
      'If this link is clicked, the folder is entered and its contents ' +
        'displayed.'
    ]
  },
  {
    id: 7,
    title: 'Select a File/Folder',
    descs: [
      'In order to select one or more files and folders to copy or delete ' +
        'them, a click in the area near file/folder name is required.'
    ]
  },
  {
    id: 8,
    title: 'Selected File/Folder appearance',
    descs: [
      'When a file or folder is selected, its background color will be blue, ' +
        'as show in the example image.'
    ]
  },
  {
    id: 9,
    title: 'Free space',
    descs: [
      'In the upper right corner of the system, free space of drive is shown.',
      'Beware not to fill your drive to much!'
    ]
  }
];

module.exports = help;
