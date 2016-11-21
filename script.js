(function() {
    // Config
    var timelinePageCount = 3;

    // Templating functions
    var setUsers = function(users) {
            console.info('called setUsers with these users:', users);
            $('#user-select').html(_.template($('#user-select-template').html())({
                users: users
            })).find('select').on('change', handleUserChange).val(Object.keys(users)[0]).trigger('change');

        },
        setTimeline = function(timeline, userKey, buttons, callback) {
            console.info('called setTimeline with this timeline:', timeline);
            $('#user-timeline').html(_.template($('#user-timeline-template').html())({
                timeline: timeline,
                userKey: userKey,
                loadMore: buttons ? buttons.loadMore || false : false,
                orderByText: buttons ? buttons.orderByText || false : false,
                reset: buttons ? buttons.reset || false : false
            }));

            if (typeof callback === 'function') {
                callback();
            }
        },
        setFollowing = function(following) {
            console.info('called setFollowing with this following:', following);

            $('#user-following').html(_.template($('#user-following-template').html())({
                following: following
            }));

        },
        setTweetBox = function(user) {
            console.info('called setTweetBox with this user:', user);
            $('#user-tweet-box').html(_.template($('#user-tweet-box-template').html())({
                user: user
            })).find('textarea').on('keyup', function(e) {
                var characterCount = $(e.target).val().length,
                    tweetLength = $('#tweet-length'),
                    tweetButton = $('#tweet-button');

                tweetLength.text(140 - characterCount);

                if (characterCount <= 140) {
                    tweetLength.css('color', 'gray');

                    if (characterCount > 0) {
                        tweetButton.removeAttr('disabled');
                    }
                } else {
                    tweetLength.css('color', 'red');
                    tweetButton.attr('disabled', 'disabled');
                }
            });
        };

    var firebaseRoot = 'https://fir-lessons.firebaseio.com/twitterClone/';
    var usersRef = new Firebase(firebaseRoot + 'users');
    var userObjectsRef = new Firebase(firebaseRoot + 'userObjects');
    var userRef;
    var userHandler;
    var tweetBoxClickHandler;
    var tweetsRef;
    var tweetAddedHandler;
    var timelineRef;
    var timelineHandler;

    usersRef.once('value', function(snap) {
        setUsers(snap.val());
    });

    var stopListening = function() {
        if (typeof timelineRef === 'object' && typeof timelineHandler) {
            timelineRef.off('value', timelineHandler);
        }

        if (typeof userRef === 'object' && typeof userHandler) {
            userRef.off('value', userHandler);
        }

        if (typeof tweetsRef === 'object' && typeof tweetAddedHandler) {
            tweetsRef.off('child_added', tweetAddedHandler);
        }
    };

    var flatten = function(tweets) {
        var keys = Object.keys(tweets);
        var i = keys.length;
        var results = [];
        var tweet;

        while (i--) {
            tweet = tweets[keys[i]];
            tweet.key = keys [i];
            results.unshift(tweet);
        };

        return results;
    };

    var handleUserChange = function(e) {
        var userKey = $(e.target).val();

        stopListening();

        if (userKey) {

            timelineRef = userObjectsRef.child('timeline').child(userKey);

            timelineHandler = timelineRef.on('value', function(snap) {
                setTimeline(flatten(snap.val()).reverse(), userKey);
            });

            userRef = usersRef.child(userKey);

            userHandler = userRef.on('value', function(snap) {
                setTweetBox(snap.val());
            });

            userObjectsRef.child('following').child(userKey).once('value', function(snap) {
                setFollowing(snap.val());
            });

            var userTweetBox = $('#user-tweet-box');

            // Prevent duplicate registration of the tweetBoxClickHandler listener
            if (typeof tweetBoxClickHandler === 'function') {
                userTweetBox.off('click', 'button', tweetBoxClickHandler);
            }

            tweetBoxClickHandler = function(e) {
                e.preventDefault();

                var tweet = {
                    created: (new Date()).toString(),
                    text: userTweetBox.find('textarea').val()
                };

                userObjectsRef.child('tweets').child(userKey).push(tweet, function(err) {
                    if (err) {
                        console.warn('error!', err);
                    } else {
                        usersRef.child(userKey).child('tweetCount').transaction(function(i) {
                            return (i || 0) + 1;
                        });
                    }
                });
            };

            userTweetBox.on('click', 'button', tweetBoxClickHandler);

            tweetsRef = userObjectsRef.child('tweets').child(userKey);

            tweetAddedHandler = tweetsRef.on('child_added', function(snap) {
                var tweet = snap.val();
                var tweetRef = snap.ref();

                if (!tweet.fannedOut) {
                    usersRef.child(userKey).once('value', function(snap) {
                        var user = snap.val();
                        console.log(user);
                        var tweetUser = {
                            email: user.email,
                            key: snap.key(),
                            name: user.name,
                            username: user.username
                        };

                        userObjectsRef.child('followers').child(userKey).child('list').once('value', function(snap) {
                            var i = snap.numChildren();
                            snap.forEach(function(childSnap) {
                                var follower = childSnap.val();
                                tweet.tweetKey = tweetRef.key();
                                tweet.user = tweetUser;
                                tweet.userKey = tweetUser.key;

                                userObjectsRef.child('timeline').child(follower.key).push(tweet, function(err) {
                                    i -= 1;
                                    if (i <= 0) {
                                        tweetRef.child('fannedOut').set(true);
                                    }
                                });
                            });
                        });
                    });
                }
            });

        } else {
            setTweetBox({});
            setTimeline({});
            setFollowing({});
        }

        $('#user-timeline').on('click', 'button.remove-tweet', function(e) {
            var target = $(e.target);
            var userKey = target.attr('user-key');
            var tweetKey = target.attr('tweet-key');

            userObjectsRef.child('tweets').child(userKey).child(tweetKey).remove(function(err) {
                if (err) {
                    console.warn('Tweet deletion error', err);
                } else {
                    usersRef.child(userKey).child('tweetCount').transaction(function(i) {
                        return Math.max(0, (i || 0) - 1);
                    });
                }
            });
        });

    };

})();
