/** @format */

jQuery(function ($) {
	'use strict';

	//* Navbar Fixed
	function navbarFixed() {
		if ($('#header').length) {
			$(window).scroll(function () {
				var scroll = $(window).scrollTop();
				if (scroll) {
					$('#header').addClass('navbar_fixed');
				} else {
					$('#header').removeClass('navbar_fixed');
				}
			});
		}
	}
	navbarFixed();

	//*============ parallaxie js ==============*/

	if ($('.parallaxie').length) {
		if ($(window).width() > 767) {
			$('.parallaxie').parallaxie({
				speed: 0.5,
			});
		}
	}

	//*============ background image js ==============*/
	$('[data-bg-img]').each(function () {
		var bg = $(this).data('bg-img');
		$(this).css({
			background: 'no-repeat center 0/cover url(' + bg + ')',
		});
	});

	// background color js
	$('[data-bg-color]').each(function () {
		var bgcolor = $(this).data('bg-color');
		$(this).css({
			'background-color': bgcolor,
		});
	});

	// wow js
	function bodyScrollAnimation() {
		var scrollAnimate = $('body').data('scroll-animation');
		if (scrollAnimate === true) {
			new WOW({}).init();
		}
	}
	bodyScrollAnimation();

	//* Navbar Fixed
	function navbarFixedTwo() {
		if ($('.sticky_nav').length) {
			$(window).scroll(function () {
				var scroll = $(window).scrollTop();
				if (scroll) {
					$('.sticky_nav').addClass('navbar_fixed');
				} else {
					$('.sticky_nav').removeClass('navbar_fixed');
				}
			});
		}
	}
	navbarFixedTwo();

	if ($('.marketing_service_item').length) {
		$('.service_tab_content').hide();
		$('.service_collapse_btn').on('click', function (event) {
			event.preventDefault();
			$(this)
				.parent()
				.removeClass('is-active')
				.find('.service_tab_content')
				.slideToggle(700);

			$(this).toggleClass('is-active');
		});
	}

	if ($('.marketing_testimonial').length) {
		$('.marketing_testimonial').slick({
			slidesToShow: 1,
			slidesToScroll: 1,
			//   asNavFor: ".testimonial_author_slider",
			dots: true,
			arrows: false,
			speed: 1200,
		});
	}

	/*=============================================== 
	       Parallax Init
	  ================================================*/
	if ($('.mouse_move').length > 0) {
		$('.mouse_move').parallax({
			scalarX: 10.0,
			scalarY: 10.0,
		});
	}

	/*-------------------------------------------------------------------------------
	  Slick js
	-------------------------------------------------------------------------------*/
	$('.testimonial_items').slick({
		infinite: true,
		slidesToShow: 1,
		slidesToScroll: 1,
		dots: false,
		arrows: true,
		prevArrow: '<i class="ph-caret-left"></i>',
		nextArrow: '<i class="ph-caret-right"></i>',
	});

	$('.ab_testimonial_slider').slick({
		infinite: true,
		slidesToShow: 3,
		slidesToScroll: 1,
		dots: true,
		arrows: false,
		responsive: true,
		responsive: [
			{
				breakpoint: 1024,
				settings: {
					slidesToShow: 3,
					slidesToScroll: 3,
					infinite: true,
					dots: true,
				},
			},
			{
				breakpoint: 991,
				settings: {
					slidesToShow: 2,
					slidesToScroll: 2,
				},
			},
			{
				breakpoint: 767,
				settings: {
					slidesToShow: 1,
					slidesToScroll: 1,
				},
			},
		],
	});

	$('.timeline_slider_items').slick({
		infinite: true,
		slidesToShow: 4,
		slidesToScroll: 1,
		dots: false,
		arrows: true,
		prevArrow: '<i class="ph-arrow-left"></i>',
		nextArrow: '<i class="ph-arrow-right"></i>',
		responsive: true,
		responsive: [
			{
				breakpoint: 1480,
				settings: {
					slidesToShow: 3,
					slidesToScroll: 1,
					infinite: true,
				},
			},
			{
				breakpoint: 1285,
				settings: {
					slidesToShow: 2,
					slidesToScroll: 1,
					infinite: true,
				},
			},
			{
				breakpoint: 768,
				settings: {
					slidesToShow: 1,
					slidesToScroll: 1,
					infinite: true,
				},
			},
		],
	});
	$('.dm_testimonial_items').slick({
		infinite: true,
		slidesToShow: 1,
		slidesToScroll: 1,
		dots: true,
		arrows: false,
	});

	/*-------------------------------------------------------------------------------
	  Counter js
	-------------------------------------------------------------------------------*/
	function counterUp() {
		if ($('.counter').length) {
			$('.counter').counterUp({
				delay: 1,
				time: 500,
			});
		}
	}

	counterUp();

	//*============ BUTTON ANIMATION js ==============*/
	$('.btn_hover')
		.on('mouseenter', function (e) {
			var parentOffset = $(this).offset(),
				relX = e.pageX - parentOffset.left,
				relY = e.pageY - parentOffset.top;
			$(this).find('span').css({ top: relY, left: relX });
		})
		.on('mouseout', function (e) {
			var parentOffset = $(this).offset(),
				relX = e.pageX - parentOffset.left,
				relY = e.pageY - parentOffset.top;
			$(this).find('span').css({ top: relY, left: relX });
		});

	function Menu_js() {
		if ($('.submenu').length) {
			$('.submenu > .dropdown-toggle').click(function () {
				var location = $(this).attr('href');
				window.location.href = location;
				return false;
			});
		}
	}
	Menu_js();

	function menu_dropdown() {
		if ($(window).width() < 992) {
			$('.menu > li .mobile_dropdown_icon').on('click', function (event) {
				event.preventDefault();
				$(this).parent().find('.dropdown-menu').first().slideToggle(700);
				$(this).parent().siblings().find('.dropdown-menu').slideUp(700);
			});
		}
	}
	menu_dropdown();

	if ($('#work-portfolio').length > 0) {
		var pr = $('#work-portfolio');
		pr.imagesLoaded(function () {
			// images have loaded
			pr.isotope({
				itemSelector: '.portfolio_item',
				layoutMode: 'masonry',
				filter: '*',
				stagger: 0,
				transitionDuration: '0.9s',
				masonry: {},
			});

			// Add isotope click function
			$('#portfolio_filter div').on('click', function () {
				$('#portfolio_filter div').removeClass('active');
				$(this).addClass('active');

				var selector = $(this).attr('data-filter');
				pr.isotope({
					filter: selector,
					animationOptions: {
						animationDuration: 750,
						easing: 'linear',
						queue: false,
					},
				});
				return false;
			});
		});
	}

	/*--------------- Start popup-js--------*/
	function popupGallery() {
		if ($('.popup-youtube').length) {
			$('.popup-youtube').magnificPopup({
				disableOn: 700,
				type: 'iframe',
				removalDelay: 160,
				preloader: false,
				fixedContentPos: false,
				mainClass: 'mfp-with-zoom mfp-img-mobile',
			});
		}

		if ($(".img_popup").length) {
            $(".img_popup").each(function () {
                $(".img_popup").magnificPopup({
                    type: "image",
                    tLoading: "Loading image #%curr%...",
                    removalDelay: 300,
                    mainClass: "mfp-with-zoom mfp-img-mobile",
                    gallery: {
                        enabled: true,
                        navigateByImgClick: true,
                        preload: [0, 1], // Will preload 0 - before current, and 1 after the current image,
                    },
                });
            });
        }
	}
	popupGallery();
	/*--------------- Start price js--------*/
	if ($('.pricing_btn .toggle').length) {
		$('.pricing_btn .toggle').on('click', function () {
			$(this).toggleClass('clicked');
			$('.pricing_plan_aiea .pricing_content').toggleClass('active');
		});
	}
});
