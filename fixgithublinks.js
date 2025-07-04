const intervalId = setInterval(() => {
    console.log('Checking for GitHub links...');
    
    const items = Array.from(document.querySelectorAll('.page-edit-shortcuts.is-right a'))
    if (!items?.length) return;

    items.filter(link => link.href.includes('github.com'))
        .forEach(link => {
            link.href = link.href.replace('/es/', '/');
        });

    clearInterval(intervalId);
    logger.info('GitHub links updated successfully.');
}, 1000);