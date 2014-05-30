/*
 * Backbone.Subviews, v0.7.3
 * Copyright (c)2013-2014 Rotunda Software, LLC.
 * Distributed under MIT license
 * http://github.com/rotundasoftware/backbone.subviews
*/
( function( root, factory ) {
	// UMD wrapper
	if ( typeof define === 'function' && define.amd ) {
		// AMD
		define( [ 'underscore', 'backbone', 'jquery' ], factory );
	} else if ( typeof exports !== 'undefined' ) {
		// Node/CommonJS
		module.exports = factory( require('underscore' ), require( 'backbone' ), require( 'backbone' ).$ );
	} else {
		// Browser globals
		factory( root._, root.Backbone, ( root.jQuery || root.Zepto || root.$ ) );
	}
}( this, function( _, Backbone, $ ) {
	Backbone.Subviews = {};

	Backbone.Subviews.add = function( view ) {
		var overriddenViewMethods = {
			render : view.render,
			remove : view.remove
		};

		// ****************** Overridden Backbone.View methods ****************** 

		view.render = function() {
			var args = Array.prototype.slice.call( arguments );

			_prerender.call( this );
			var returnValue = overriddenViewMethods.render.apply( this, args );
			_postrender.call( this );

			return returnValue;
		};

		view.remove = function() {
			this.removeSubviews();
			return overriddenViewMethods.remove.call( this );
		};

		// ****************** Additional public methods ****************** 

		view.removeSubviews = function() {
			// Removes all subviews and cleans up references in this.subviews.

			if( this.subviews ) {
				_.each( this.subviews, function( thisSubview ) {
					if (thisSubview.remove)
						thisSubview.remove();
				} );

				delete this.subviews;
			}
		};

		// ****************** Additional private methods ****************** 

		view._createSubview = function( subviewName, placeHolderDiv ) {
			// Return a new subview instance given a subview name and its placeHolderDiv.
			// Implemented as instance method so that this behavior may be customized / overridden.
			var subviewCreator = this.subviewCreators[ subviewName ];
			if( _.isUndefined( subviewCreator ) ) throw new Error( "Can not find subview creator for subview named: " + subviewName );

			return subviewCreator.apply( this );
		};
	};

	// ****************** Private utility functions ****************** 

	function _isPromise(view) {
		return (view && view.promise && view.done);
	}

	function _renderView(name, view, placeholders) {
		if (view) {
			placeholders[ name ].replaceWith( view.$el );
			view.render();
		}
	}

	function _prerender() {
		if( ! this.subviews ) this.subviews = {};

		// Detach each of our subviews that we have already created during previous
		// renders from the DOM, so that they do not loose their DOM events when
		// we re-render the contents of this view's DOM element.
		_.each( this.subviews, function( thisSubview ) {
			thisSubview.$el.detach();
		} );
	}

	function _postrender() {
		var _this = this;
		this.subviewCreators = this.subviewCreators || {};
		this.placeHolderDivs = this.placeHolderDivs || {};

		// Support subviewCreators as both objects and functions.
		this.subviewCreators = _.result( this, "subviewCreators" );
		
		this.$( "[data-subview]" ).each( function() {
			var thisPlaceHolderDiv = $( this );
			var subviewName = thisPlaceHolderDiv.attr( "data-subview" );
			var newSubview;

			if( _.isUndefined( _this.subviews[ subviewName ] ) ) {
				newSubview = _this._createSubview( subviewName, thisPlaceHolderDiv );
				if( newSubview === null ) return;  // subview creators can return null to indicate that the subview should not be created
				_this.subviews[ subviewName ] = newSubview;
				_this.placeHolderDivs[ subviewName ] = thisPlaceHolderDiv;
			}
			else {
				// If the subview is already defined, then use the existing subview instead
				// of creating a new one. This allows us to re-render a parent view without
				// loosing any dynamic state data on the existing subview objects. To force
				// re-initialization of subviews, call view.removeSubviews before re-rendering.

				newSubview = _this.subviews[ subviewName ];
			}
		});

		$.when.apply(this, _.filter(this.subviews, _isPromise)).done(function() {
			// now that all subviews have been created, render them one at a time, in the
			// order they occur in the DOM.
			_.each( _this.subviews, function( thisSubview, subviewName ) {
				// If it's a promise object, we'll wait for it to resolve to a view
				// before we render it. We'll also replace the view so we don't have
				// to resolve the object every time.
				if (thisSubview && thisSubview.promise && thisSubview.done) {
					thisSubview.done(function(view) {
						_this.subviews[ subviewName ] = thisSubview = view;
						_renderView(subviewName, thisSubview, _this.placeHolderDivs);
					});
				} else {
					_renderView(subviewName, thisSubview, _this.placeHolderDivs);
				}
			});

			if( _.isFunction( _this.onSubviewsRendered ) ) _this.onSubviewsRendered.call( _this );
			if( _.isFunction( _this._onSubviewsRendered ) ) _this._onSubviewsRendered.call( _this ); // depreciated. backwards compatibility for versions < 0.6.
		});
	}

	return Backbone.Subviews;
} ) );
