let intervalId = setInterval(() => {

    const items = Array.from(document.querySelectorAll('.page-edit-shortcuts.is-right a'))
    if (!items?.length) return
        
    clearInterval(intervalId);
    
    items.filter(link => link.href.includes('github.com'))
        .forEach(link => {
            link.href = link.href.replace('/es/', '/');
        });

}, 1000);