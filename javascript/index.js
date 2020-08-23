jQuery(document).ready(function($) {
    var initialScrollPos = $(window).scrollTop()
    if (initialScrollPos > 48) $(".x-navbar").addClass("alt-color");

    $(window).scroll(function() {
      var scrollPos = $(window).scrollTop(),
          navbar = $('.x-navbar');
  
      if (scrollPos > 48) {
          navbar.addClass('alt-color');
      } else {
          navbar.removeClass('alt-color');
      }
    });

    $(".navbar-toggler").click(function(){
        var scrollPos = $(window).scrollTop()
        if (scrollPos <= 48) $(".x-navbar").toggleClass("alt-color");
        $(".x-navbar").toggleClass("expanded");
    })
});