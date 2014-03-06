/*
 * Copyright (c) 2009 Nicholas C. Zakas
 * Copyright (c) 2014 Todd M. Horst
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

(function ($) {

    $.idleTimer = function (firstParam, opts, elem) {
   
      
        elem = elem || document;

        // defaults that are to be stored as instance props on the elem
        opts = $.extend({
            idle: false,            //indicates if the user is idle
            enabled: true,          //indicates if the idle timer is enabled
            timeout: 30000,         //the amount of time (ms) before the user is considered idle
            events: "mousemove keydown wheel DOMMouseScroll mousewheel mousedown touchstart touchmove MSPointerDown MSPointerMove" // activity is one of these events
        }, opts);

       


        var jqElem = $(elem),
            obj = jqElem.data("idleTimerObj") || {},

            /* (intentionally not documented)
             * Toggles the idle state and fires an appropriate event.
             * @return {void}
             */
            toggleIdleState = function (myelem) {

                // curse you, mozilla setTimeout lateness bug!
                if (typeof myelem === "number") {
                    myelem = undefined;
                }

                var obj = $.data(myelem || elem, "idleTimerObj");

                //toggle the state
                obj.idle = !obj.idle;

                // reset timeout
                var elapsed = (+new Date()) - obj.olddate;
                obj.olddate = +new Date();

                // handle Chrome always triggering idle after js alert or comfirm popup,
                // not happening in Version 33.0.1750.117 m desktop win7               
                if (obj.idle && (elapsed < obj.timeout)) {
                    obj.idle = false;
                    clearTimeout(obj.tId);
                    if (obj.enabled) {
                        obj.tId = setTimeout(toggleIdleState, obj.timeout);
                    }
                    return;
                }

                // create a custom event, but first, store the new state on the element
                // and then append that string to a namespace
                var event = $.Event($.data(elem, "idleTimer", obj.idle ? "idle" : "active") + ".idleTimer");
                $(elem).trigger(event, [elem, jQuery.extend({},obj)]);
            },
            /**
             * Handle event triggers
             * @return {void}
             * @method event
             * @static
             */
            handleEvent = function (jqElem, e) {

                var obj = jqElem.data("idleTimerObj") || {};

                /*
                mousemove is kinda buggy, it can be triggered when it should be idle.
                Typically is happening between 115 - 150 milliseconds after idle triggered.
                @psyafter & @kaellis report "always triggered if using modal (jquery ui, with overlay)"
                @thorst has similar issues on ios7 "after $.scrollTop() on text area"
                */
                if (e.type === "mousemove") {
                    //If coord are same, it didnt move
                    if (e.pageX === obj.pageX && e.pageY === obj.pageY) {
                        return;
                    }
                    //If coord dont exist how could it move
                    if (typeof e.pageX === "undefined" && typeof e.pageY === "undefined") {
                        return;
                    }
                    // under 200 ms is hard to do, and you would have to stop, as continuous activity will bypass this
                    var elapsed = (+new Date()) - obj.olddate;
                    if (elapsed < 200) {
                        return;
                    }
                }

                //clear any existing timeout
                clearTimeout(obj.tId);

                //if the idle timer is enabled
                if (obj.enabled) {
                    if (obj.idle) {
                        toggleIdleState(elem);
                    }

                    //store when user was last active
                    obj.lastActive = +new Date();

                    //Update mouse coord
                    obj.pageX = e.pageX;
                    obj.pageY = e.pageY;

                    //set a new timeout
                    obj.tId = setTimeout(function () { toggleIdleState(elem); }, obj.timeout);
                }
            },
            /**
             * Restore initial settings and restart timer
             * @return {void}
             * @method reset
             * @static
             */
            reset = function (jqElem) {

                var obj = jqElem.data("idleTimerObj") || {};

                //Reset settings
                obj.idle = obj.idleBackup;
                obj.enabled = obj.enabledBackup;

                obj.olddate = +new Date();

                //Reset Timers
                clearTimeout(obj.tId);
                if (!obj.idle) {
                    obj.tId = setTimeout(function () {toggleIdleState(elem); }, obj.timeout);
                }                

            },
            /**
             * Store remaining time, stop timer
             * @return {void}
             * @method pause
             * @static
             */
            pause = function (jqElem) {

                var obj = jqElem.data("idleTimerObj") || {};
              
                //This is already paused
                if (obj.remaining != null) { return; }

                //Define how much is left on the timer
                obj.remaining = obj.timeout - ((+new Date()) - obj.olddate);
            
                //If its already idle, or there isnt any time left
                if (obj.idle || obj.remaining <= 0) {
                    obj.remaining = null;
                    return;
                }
    
                //clear any existing timeout
                clearTimeout(obj.tId);

            },
            /**
             * Start timer with remaining value
             * @return {void}
             * @method resume
             * @static
             */
            resume = function (jqElem) {

                var obj = jqElem.data("idleTimerObj") || {};
                if (obj.remaining == null) { return; }

                //start timer
                obj.tId = setTimeout(toggleIdleState, obj.remaining);

                obj.remaining = null;
            },
            /**
             * Stops the idle timer. This removes appropriate event handlers
             * and cancels any pending timeouts.
             * @return {void}
             * @method stop
             * @static
             */
            stop = function (jqElem) {

                var obj = jqElem.data("idleTimerObj") || {};

                //set to disabled
                obj.enabled = false;

                //clear any pending timeouts
                clearTimeout(obj.tId);

                //detach the event handlers
                jqElem.off(".idleTimer");
            };

        
        
        //Determine which function to call
        if (typeof firstParam === "number") {
            opts.timeout = firstParam;
        } else if (firstParam === "destroy") {
            stop(jqElem);
            return;
        } else if (firstParam === "pause") {
            pause(jqElem);
            console.log(obj.remaining);
            return;
        } else if (firstParam === "resume") {
            resume(jqElem);
            return;
        } else if (firstParam === "reset") {
            reset(jqElem);
            return;
        } else if (firstParam === "getRemainingTime") {
            //If idle there is no time remaining
            if (obj.idle) { return 0; }

            //Determing remaining, if negative idle didnt finish flipping, just return 0
            var remaining = obj.timeout - ((+new Date()) - obj.lastActive);
            if (remaining < 0) { remaining = 0; }

            //If this is paused return that number, else return current remaining
            return obj.remaining || remaining;
        } else if (firstParam === "getElapsedTime") {
            return (+new Date()) - obj.olddate;
        } else if (firstParam === "getLastActiveTime") {
            return obj.lastActive;
        //} else if (firstParam === "getState") {
        //    return obj.idle ? "idle" : "active";
        } else if (firstParam === "isIdle") {
            return obj.idle;
        }


        /* (intentionally not documented)
         * Handles a user event indicating that the user isn't idle.
         * @param {Event} event A DOM2-normalized event object.
         * @return {void}
         */
        jqElem.on($.trim((opts.events + " ").split(" ").join(".idleTimer ")), function (e) {
            //console.log(e.type);//get the event that was triggered
            handleEvent($(this), e);
        });

        
        //Internal Object Properties
        obj.olddate = +new Date();          //the last time state changed
        obj.lastActive = obj.olddate;       //the last time timer was active
        obj.idle = opts.idle;               //current state
        obj.idleBackup = opts.idle;         //backup of idle parameter since it gets modified
        obj.enabled = opts.enabled;         //if this is currently enabled
        obj.enabledBackup = opts.enabled;   //backup of enabled parameter since it gets modified
        obj.timeout = opts.timeout;         //the interval to change state
        obj.remaining = null;               //how long until state changes
        obj.tId = null;                     //the idle timer setTimeout

        //set a timeout to toggle state. May wish to omit this in some situations
        if (!obj.idle) {
            obj.tId = setTimeout(function () { $(elem).data("idleTimerObj").idle = false; toggleIdleState(elem); }, obj.timeout);
        }

        // assume the user is active for the first x seconds.
        jqElem.data("idleTimer", obj.idle ? "idle" : "active");

        // store our instance on the object
        jqElem.data("idleTimerObj", obj);
        
    };

    //This allows binding to element
    $.fn.idleTimer = function (firstParam, opts) {
        // Allow omission of opts for backward compatibility
        if (!opts) {
            opts = {};
        }

        if (this[0]) {
            var result = $.idleTimer(firstParam, opts, this[0]);
            if (result === false) {
                return this;
            } else {
                return result;
            }
        }

        return this;
    };

})(jQuery);
