const ALT_COLOUR_SCROLL_POS = 36;

function getScrollPos () {
    return window.pageYOffset || document.documentElement.scrollTop;
}

jQuery(document).ready(function($) {
    var initialScrollPos = getScrollPos();
    console.log({initialScrollPos})
    if (initialScrollPos > ALT_COLOUR_SCROLL_POS) $(".x-navbar").addClass("alt-color");

    window.onscroll = function() {
        var scrollPos = getScrollPos(),
            navbar = $('.x-navbar');
                
        if (scrollPos > ALT_COLOUR_SCROLL_POS) {
            navbar.addClass('alt-color');
        } else {
            navbar.removeClass('alt-color');
        }
    };

    $(".navbar-toggler").click(function(){
        var scrollPos = getScrollPos();
        if (scrollPos <= ALT_COLOUR_SCROLL_POS) $(".x-navbar").toggleClass("alt-color");
        $(".x-navbar").toggleClass("expanded");
    })
});
