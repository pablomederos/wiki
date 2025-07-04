Array.from(document.querySelectorAll('.page-edit-shortcuts.is-right a'))
    .filter(link => link.href.includes('github.com'))
    .forEach(link => {
        link.href = link.href.replace('/es/', '/');
    });