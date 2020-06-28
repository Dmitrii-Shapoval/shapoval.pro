// Close welcome.......................................................
let modal = document.querySelector('.modal');
let modalTxt = document.querySelector('.modal__txt');

modalTxt.addEventListener('webkitAnimationEnd', () => {    // For Safari
    modal.classList.add('modal_closed');
});
modalTxt.addEventListener('animationend', () => {
    modal.classList.add('modal_closed');
});
modalTxt.removeEventListener('webkitAnimationEnd', outsideEvtListener, false);     // For Safari
modalTxt.removeEventListener('animationend', outsideEvtListener, false);
// .......................................................Close welcome


// Show hover window...................................................
const mailingAddress = document.querySelector('.mailing-address');
const mail = document.querySelector('.mail');
mail.addEventListener('mouseover', () => {
    mailingAddress.classList.add('mailing-address_open');
});
// ...................................................Show hover window
// Hide window when clicking outside the are............................
document.addEventListener('click', outsideEvtListener);
function outsideEvtListener(e) {
    if (e.target === mail || mail.contains(e.target)) {
        return; // сlick inside
    }
    mailingAddress.classList.remove('mailing-address_open'); // Hide the menus.
}
// ............................Hide window when clicking outside the are


// Select text input....................................................
const input = document.getElementById('mailingAddressTxt');
function selectText() {
    input.focus();
    input.select();
}
// ....................................................Select text input


// Copy to clipboard on click...........................................
mail.addEventListener('click', () => {
    const nameEmail = 'dmitrii@shapoval.pro';
    navigator.clipboard.writeText(nameEmail)
        .then(() => {
            // Success!
        })
        .catch(err => {
            location.href = 'mailto:dmitrii@shapoval.pro'
        });
    // Clipboard API Browser Support Test...............
    if (navigator.clipboard) {
        const tooltip = document.getElementById('MailingAddressTooltip');  // Working
        tooltip.innerHTML = "✉ Copied!";
    } else {
        location.href = 'mailto:dmitrii@shapoval.pro' // Not working
    }
    // ...............Clipboard API Browser Support Test
    selectText();   // Select text input
});
// ...........................................Copy to clipboard on click


// Year update..........................................................
document.querySelector('.copyright__this-year').innerHTML = new Date().getFullYear();
// ..........................................................Year update
