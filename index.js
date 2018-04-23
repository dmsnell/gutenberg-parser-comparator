// @ts-check 
const l = m => ( console.log( m ), m );

// how long to iterate when benchmarking
const LOOP_TIME = 100;

const state = {
    input: {
        prevParser: a => false,
        nextParser: a => false,
        postList: []
    },

    posts: {}
};
window.state = state;

function initialize( next ) {
    const prevParser = eval( document.getElementById( 'prev-parser-content' ).value );
    const nextParser = eval( document.getElementById( 'next-parser-content' ).value );
    const postList = document.getElementById( 'post-list-content' ).value.split('\n').filter(Boolean);

    state.input.prevParser = prevParser();
    state.input.nextParser = nextParser();
    state.input.postList = postList;

    next();
}

function renderLoadingPosts() {
    const loadingPosts = document.getElementById( 'loading-posts' );

    let output = '<ul>';
    for ( let name in state.posts ) {
        const post = state.posts[ name ];
        switch ( post.status ) {
            case 'loading':
                output += post.transfer.total > 0
                    ? '<li>' + name + ': ' + Math.floor( 100 * post.transfer.loaded / post.transfer.total ) + '%</li>'
                    : '<li>' + name + ': loading (unknown size)</li>';
                break;
            
            case 'loaded':
                output += '<li>' + name + ': loaded</li>';
                break;
            
            case 'failed':
                output += '<li>' + name + ': failed (' + post.transfer.status + ')</li>';
                break;
        }
    }
    output += '</ul>';

    loadingPosts.innerHTML = output;
}

function loadPosts( next ) {
    const startedAt = performance.now();
    const postCount = state.input.postList.length;
    let loadedPosts = 0;

    const queueNext = () => {
        renderLoadingPosts();

        if ( loadedPosts === postCount ) {
            const endedAt = performance.now();
            document.getElementById( 'loading-posts' ).innerHTML += '<p>Took ' + Math.ceil( endedAt - startedAt ) + ' ms to load posts</p>';
            next();
        }
    }

    for ( let i = 0; i < postCount; i++ ) {
        const post = state.input.postList[ i ];
        const name = post.replace( /.+\//g, '' );
        state.posts[ name ] = {
            content: '',
            runs: {
                prev: { ms: 0, count: 0 },
                next: { ms: 0, count: 0 }
            },
            status: 'loading',
            transfer: {
                loaded: 0,
                total: 0
            }
        }

        queueNext();

        const xhr = new XMLHttpRequest();
        xhr.open( 'GET', post );

        xhr.onprogress = event => {
            state.posts[ name ].transfer = {
                loaded: event.loaded,
                total: event.total
            }

            queueNext();
        };

        xhr.onload = () => {
            state.posts[ name ].content = xhr.responseText;
            state.posts[ name ].status = 'loaded';
            loadedPosts += 1;

            queueNext();
        };

        xhr.onerror = () => {
            state.posts[ name ].transfer.status = xhr.status;
            state.posts[ name ].status = 'failed';
            loadedPosts += 1;

            queueNext();
        };

        xhr.send();
    }
}

function compareOutputs( next ) {
    const startedAt = performance.now();
    const output = document.getElementById( 'comparing-parsers' );
    output.innerHTML = '';
    const o = m => output.innerHTML += m;

    o( '<p>Comparing parsers&hellip;</p>' );

    o( '<ul>' );
    for ( let name in state.posts ) {
        const post = state.posts[ name ];

        if ( post.status !== 'loaded' ) {
            continue;
        }

        post.prevParse = state.input.prevParser( post.content );
        post.nextParse = state.input.nextParser( post.content );

        post.isEqual = window.deepEqual( post.prevParse, post.nextParse );

        o( '<li>' + name + ': ' + ( post.isEqual ? 'match' : 'mismatch' ) + '</li>' );
    }
    o( '</ul>' );

    const endedAt = performance.now();
    o( '<p>Took ' + Math.ceil( endedAt - startedAt ) + ' ms to compare parsers</p>' );

    next();
}

function benchmark( next ) {
    const startedAt = performance.now();
    const output = document.getElementById( 'benchmark' );
    output.innerHTML = '';
    const o = m => output.innerHTML += m;
    let stillRunning = true;

    const stopper = document.createElement( 'button' );
    stopper.setAttribute( 'id', 'stop-benchmark' );
    stopper.innerHTML = 'Stop benchmark';
    stopper.addEventListener( 'click', () => {
        stillRunning = false;
        stopper.parentNode.removeChild( stopper );
    } );
    output.parentNode.appendChild( stopper );

    const finish = () => {
        const endedAt = performance.now();
        o( '<p>Took ' + Math.ceil( endedAt - startedAt ) / 1000 + ' s to run benchmark</p>' );
        next();
    };

    o( '<div id="benchmark-results"></div>' );

    const posts = Object.keys( state.posts ).filter( name => state.posts[ name ].status === 'loaded' );
    const postCount = posts.length;

    const report = document.getElementById( 'benchmark-results' );
    const ul = document.createElement( 'ul' );
    for ( let i = 0; i < posts.length; i++ ) {
        const name = posts[ i ];
        const post = state.posts[ name ];
        const id = 'post-report-' + name;
        const li = document.createElement( 'ui' );
        li.setAttribute( 'id', id );
        li.innerHTML = name + ': not yet benchmarked';
        state.posts[ name ].node = li;
        ul.appendChild( li );
    }
    report.appendChild( ul );

    const loop = () => {
        // grab a random post and randomly pick the parser
        const choice = ( Math.random() > 0.5 ) ? 'prev' : 'next';
        const parse = choice === 'prev' ? state.input.prevParser : state.input.nextParser;
        const name = posts[ Math.floor( Math.random() * postCount ) ];
        const post = state.posts[ name ];
        const tic = performance.now();
        let toc = tic;
        let count = 0;
        let ms = 0;
        const RUNTIME = post.runLong ? 3 * LOOP_TIME : LOOP_TIME;

        do {
            const content = post.content + '<p>' + count + '</p>';
            const _tic = performance.now();
            parse( content );
            toc = performance.now();
            count += 1;
            ms += toc - _tic;
        } while ( toc - tic < RUNTIME );

        post.runLong = count < 3;

        post.runs[ choice ].ms += ms;
        post.runs[ choice ].count += count;

        const prevAvg = Math.round( 1000 * post.runs.prev.ms / ( post.runs.prev.count + Number.EPSILON ) ) / 1000; 
        const nextAvg = Math.round( 1000 * post.runs.next.ms / ( post.runs.next.count + Number.EPSILON ) ) / 1000;
        const diff = Math.abs( prevAvg - nextAvg );

        post.node.innerHTML = (
            '<div>' + 
            '<p><strong>' + name + '</strong> - ' + ( prevAvg < nextAvg ? 'prev' : 'next') + ' faster by ' + Math.floor( 1000 * diff ) / 1000 + ' ms (' + Math.floor( 1000 * diff / Math.max( prevAvg, nextAvg ) ) / 10 + '%)</p>' +
            '<p' + ( prevAvg < nextAvg ? ' style="color: green;"' : '' ) + '>prev: ' + prevAvg + ' ms avg (' + post.runs.prev.count + ' runs)</p>' +
            '<p' + ( nextAvg < prevAvg ? ' style="color: green;"' : '' ) + '>next: ' + nextAvg + ' ms avg (' + post.runs.next.count + ' runs)</p>' +
            '</div>'
        );

        setTimeout( stillRunning ? loop : finish, 10 );
    };

    setTimeout( loop, 10 );
}

function runParser() {
    (
        () => initialize( 
        () => loadPosts( 
        () => compareOutputs( 
        () => benchmark( 
        () => l( 'Done' ) 
    ) ) ) ) )();
}

// window.deepEqual = require('deep-equal');
!function(t){var e={};function r(n){if(e[n])return e[n].exports;var o=e[n]={i:n,l:!1,exports:{}};return t[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}r.m=t,r.c=e,r.d=function(t,e,n){r.o(t,e)||Object.defineProperty(t,e,{configurable:!1,enumerable:!0,get:n})},r.r=function(t){Object.defineProperty(t,"__esModule",{value:!0})},r.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return r.d(e,"a",e),e},r.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},r.p="",r(r.s=3)}([function(t,e){var r="[object Arguments]"==function(){return Object.prototype.toString.call(arguments)}();function n(t){return"[object Arguments]"==Object.prototype.toString.call(t)}function o(t){return t&&"object"==typeof t&&"number"==typeof t.length&&Object.prototype.hasOwnProperty.call(t,"callee")&&!Object.prototype.propertyIsEnumerable.call(t,"callee")||!1}(e=t.exports=r?n:o).supported=n,e.unsupported=o},function(t,e){function r(t){var e=[];for(var r in t)e.push(r);return e}(t.exports="function"==typeof Object.keys?Object.keys:r).shim=r},function(t,e,r){var n=Array.prototype.slice,o=r(1),u=r(0),c=t.exports=function(t,e,r){return r||(r={}),t===e||(t instanceof Date&&e instanceof Date?t.getTime()===e.getTime():!t||!e||"object"!=typeof t&&"object"!=typeof e?r.strict?t===e:t==e:function(t,e,r){var p,l;if(f(t)||f(e))return!1;if(t.prototype!==e.prototype)return!1;if(u(t))return!!u(e)&&(t=n.call(t),e=n.call(e),c(t,e,r));if(i(t)){if(!i(e))return!1;if(t.length!==e.length)return!1;for(p=0;p<t.length;p++)if(t[p]!==e[p])return!1;return!0}try{var a=o(t),y=o(e)}catch(t){return!1}if(a.length!=y.length)return!1;for(a.sort(),y.sort(),p=a.length-1;p>=0;p--)if(a[p]!=y[p])return!1;for(p=a.length-1;p>=0;p--)if(l=a[p],!c(t[l],e[l],r))return!1;return typeof t==typeof e}(t,e,r))};function f(t){return null===t||void 0===t}function i(t){return!(!t||"object"!=typeof t||"number"!=typeof t.length)&&("function"==typeof t.copy&&"function"==typeof t.slice&&!(t.length>0&&"number"!=typeof t[0]))}},function(t,e,r){window.deepEqual=r(2)}]);