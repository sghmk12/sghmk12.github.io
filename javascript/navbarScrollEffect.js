const ALT_COLOUR_SCROLL_POS = 36;

function getScrollPos () {
    return window.pageYOffset || document.documentElement.scrollTop;
}

jQuery(document).ready(function($) {
    var navbar = $('.x-navbar'),
        title = $('.x-navbar-hidden-title');
    navbar.expanded = false;
    var initialScrollPos = getScrollPos();
    
    if (initialScrollPos > ALT_COLOUR_SCROLL_POS) navbar.addClass("alt-color");
    
    window.onscroll = function() {
        var scrollPos = getScrollPos();
            
        if(!navbar.expanded){
            if (scrollPos <= ALT_COLOUR_SCROLL_POS) {
                navbar.removeClass('alt-color');
            } else {
                navbar.addClass('alt-color');
            }
        }
        if (scrollPos <= ALT_COLOUR_SCROLL_POS) {
            title.removeClass('show');
        } else {
            title.addClass('show');
        }
    };

    $(".navbar-toggler").click(function(){
        var scrollPos = getScrollPos();
        if (scrollPos <= ALT_COLOUR_SCROLL_POS) navbar.toggleClass("alt-color");
        navbar.toggleClass("expanded");
        navbar.expanded = !navbar.expanded;
    })
});
