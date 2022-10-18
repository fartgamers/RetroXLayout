let user = {};
let mediaToUpload = [];
let linkColors = {};
let cursor, likeCursor, retweetCursor, retweetCommentsCursor;
let seenReplies = [];
let mainTweetLikers = [];
let pageData = {};
let tweets = [];
let currentLocation = location.pathname;

// Util

function savePageData(path) {
    if(!path) {
        path = location.pathname.split('?')[0].split('#')[0];
        if(path.endsWith('/')) path = path.slice(0, -1);
    }
    pageData[path] = {
        linkColors, cursor, likeCursor, retweetCursor, retweetCommentsCursor, mainTweetLikers, seenReplies,
        tweets,
        scrollY
    }
    console.log(`Saving page: ${path}`, pageData[path]);
}
async function restorePageData() {
    let path = location.pathname.split('?')[0].split('#')[0];
    if(path.endsWith('/')) path = path.slice(0, -1);
    if(pageData[path]) {
        console.log(`Restoring page: ${path}`, pageData[path]);
        linkColors = pageData[path].linkColors;
        cursor = pageData[path].cursor;
        likeCursor = pageData[path].likeCursor;
        retweetCursor = pageData[path].retweetCursor;
        retweetCommentsCursor = pageData[path].retweetCommentsCursor;
        mainTweetLikers = pageData[path].mainTweetLikers;
        seenReplies = [];
        tweets = [];
        let tl = document.getElementById('timeline');
        tl.innerHTML = '';
        for(let i in pageData[path].tweets) {
            let t = pageData[path].tweets[i];
            if(t[0] === 'tweet') {
                await appendTweet(t[1], tl, t[2]);
            } else if(t[0] === 'compose') {
                await appendComposeComponent(tl, t[1]);
            } else if(t[0] === 'tombstone') {
                await appendTombstone(tl, t[1]);
            }
        }
        let id = currentLocation.match(/status\/(\d{1,32})/)[1];
        if(id) {
            setTimeout(() => {
                let tweet = document.getElementsByClassName(`tweet-id-${id}`)[0];
                if(tweet) {
                    tweet.scrollIntoView({ block: 'center' });
                }
                document.getElementById('loading-box').hidden = true;
            }, 100);
        } else {
            document.getElementById('loading-box').hidden = true;
        }
        return true;
    } else {
        tweets = [];
        seenReplies = [];
    }
    return false;
}

let subpage;
function updateSubpage() {
    let path = location.pathname.slice(1);
    if(path.endsWith('/')) path = path.slice(0, -1);

    let tlDiv = document.getElementById('timeline');
    let rtDiv = document.getElementById('retweets');
    let rtwDiv = document.getElementById('retweets_with_comments');
    let likesDiv = document.getElementById('likes');
    let rtMore = document.getElementById('retweets-more');
    let rtwMore = document.getElementById('retweets_with_comments-more');
    let likesMore = document.getElementById('likes-more');
    tlDiv.hidden = true; rtDiv.hidden = true; rtwDiv.hidden = true; likesDiv.hidden = true;
    rtMore.hidden = true; rtwMore.hidden = true; likesMore.hidden = true;

    if(path.split('/').length === 3) {
        subpage = 'tweet';
        tlDiv.hidden = false;
    } else {
        if(path.endsWith('/retweets')) {
            subpage = 'retweets';
            rtDiv.hidden = false;
        } else if(path.endsWith('/likes')) {
            subpage = 'likes';
            likesDiv.hidden = false;
        } else if(path.endsWith('/retweets/with_comments')) {
            subpage = 'retweets_with_comments';
            rtwDiv.hidden = false;
        }
    }
}

function updateUserData() {
    API.verifyCredentials().then(u => {
        user = u;
        userDataFunction(u);
        renderUserData();
    }).catch(e => {
        if (e === "Not logged in") {
            window.location.href = "https://mobile.twitter.com/login";
        }
        console.error(e);
    });
}
async function updateReplies(id, c) {
    if(!c) document.getElementById('timeline').innerHTML = '';
    let tl, tweetLikers;
    try {
        let [tlData, tweetLikersData] = await Promise.allSettled([API.getReplies(id, c), API.getTweetLikers(id)]);
        if(!tlData.value) {
            cursor = undefined;
            console.error(tlData.reason);
            appendTombstone(document.getElementById('timeline'), tlData.reason);
            document.getElementById('loading-box').hidden = true;
            return;
        }
        tl = tlData.value;
        tweetLikers = tweetLikersData.value;
        loadingNewTweets = false;
    } catch(e) {
        loadingNewTweets = false;
        return cursor = undefined;
    }

    if(vars.linkColorsInTL) {
        let tlUsers = [];
        for(let i in tl.list) {
            let t = tl.list[i];
            if(t.type === 'tweet' || t.type === 'mainTweet') { if(!tlUsers.includes(t.data.user.screen_name)) tlUsers.push(t.data.user.screen_name); }
            else if(t.type === 'conversation') {
                for(let j in t.data) {
                    tlUsers.push(t.data[j].user.screen_name);
                }
            }
        }
        tlUsers = tlUsers.filter(i => !linkColors[i]);
        let linkData = await fetch(`https://dimden.dev/services/twitter_link_colors/get_multiple/${tlUsers.join(',')}`).then(res => res.json()).catch(console.error);
        if(linkData) for(let i in linkData) {
            linkColors[linkData[i].username] = linkData[i].color;
        }
    }

    cursor = tl.cursor;
    let mainTweet;
    let mainTweetIndex = tl.list.findIndex(t => t.type === 'mainTweet');
    let tlContainer = document.getElementById('timeline');
    for(let i in tl.list) {
        let t = tl.list[i];
        if(t.type === 'mainTweet') {
            mainTweetLikers = tweetLikers.list;
            likeCursor = tweetLikers.cursor;
            document.getElementsByTagName('title')[0].innerText = `${t.data.user.name} on Twitter: "${t.data.full_text.slice(0, 100)}"`;
            if(i === 0) {
                mainTweet = await appendTweet(t.data, tlContainer, {
                    mainTweet: true,
                    bigFont: true
                });
            } else {
                mainTweet = await appendTweet(t.data, tlContainer, {
                    noTop: true,
                    mainTweet: true,
                    bigFont: true
                });
            }
            if(t.data.limited_actions !== "non_compliant") appendComposeComponent(tlContainer, t.data);
        }
        if(t.type === 'tweet') {
            await appendTweet(t.data, tlContainer, {
                noTop: i !== 0 && i < mainTweetIndex,
                threadContinuation: i < mainTweetIndex
            });
        } else if(t.type === 'conversation') {
            for(let i2 in t.data) {
                let t2 = t.data[i2];
                await appendTweet(t2, tlContainer, {
                    noTop: +i2 !== 0,
                    threadContinuation: +i2 !== t.data.length - 1,
                    threadButton: +i2 === t.data.length - 1,
                    threadId: t2.conversation_id_str
                });
            }
        } else if(t.type === 'tombstone') {
            appendTombstone(tlContainer, t.data);
        }
    }
    if(mainTweet) mainTweet.scrollIntoView();
    document.getElementById('loading-box').hidden = true;
    return true;
}
async function updateLikes(id, c) {
    let tweetLikers;
    if(!c && mainTweetLikers.length > 0) {
        tweetLikers = mainTweetLikers;
    } else {
        try {
            tweetLikers = await API.getTweetLikers(id, c);
            likeCursor = tweetLikers.cursor;
            tweetLikers = tweetLikers.list;
            if(!c) mainTweetLikers = tweetLikers;
        } catch(e) {
            console.error(e);
            return likeCursor = undefined;
        }
    }
    let likeDiv = document.getElementById('likes');

    if(!c) {
        likeDiv.innerHTML = '';
        let tweet = await appendTweet(await API.getTweet(id), likeDiv, {
            mainTweet: true
        });
        tweet.style.borderBottom = '1px solid var(--border)';
        tweet.style.marginBottom = '10px';
        tweet.style.borderRadius = '5px';
        let h1 = document.createElement('h1');
        h1.innerText = LOC.liked_by.message;
        h1.className = 'cool-header';
        likeDiv.appendChild(h1);
    }

    if(!likeCursor || tweetLikers.length === 0) {
        document.getElementById("likes-more").hidden = true;
    } else {
        document.getElementById("likes-more").hidden = false;
    }

    for(let i in tweetLikers) {
        let u = tweetLikers[i];
        let likeElement = document.createElement('div');
        likeElement.classList.add('following-item');
        likeElement.innerHTML = `
        <div>
            <a href="https://twitter.com/${u.screen_name}" class="following-item-link">
                <img src="${u.profile_image_url_https}" alt="${u.screen_name}" class="following-item-avatar tweet-avatar" width="48" height="48">
                <div class="following-item-text">
                    <span class="tweet-header-name following-item-name">${escapeHTML(u.name)}</span><br>
                    <span class="tweet-header-handle">@${u.screen_name}</span>
                </div>
            </a>
        </div>
        <div>
            <button class="following-item-btn nice-button ${u.following ? 'following' : 'follow'}">${u.following ? LOC.following_btn.message : LOC.follow.message}</button>
        </div>`;

        let followButton = likeElement.querySelector('.following-item-btn');
        followButton.addEventListener('click', async () => {
            if (followButton.classList.contains('following')) {
                await API.unfollowUser(u.screen_name);
                followButton.classList.remove('following');
                followButton.classList.add('follow');
                followButton.innerText = LOC.follow.message;
            } else {
                await API.followUser(u.screen_name);
                followButton.classList.remove('follow');
                followButton.classList.add('following');
                followButton.innerText = LOC.following_btn.message;
            }
        });

        likeDiv.appendChild(likeElement);
    }
    if(!likeCursor || tweetLikers.length === 0) {
        document.getElementById('likes-more').hidden = true;
    } else {
        document.getElementById('likes-more').hidden = false;
    }
    document.getElementById('loading-box').hidden = true;
}
async function updateRetweets(id, c) {
    let tweetRetweeters;
    try {
        tweetRetweeters = await API.getTweetRetweeters(id, c);
        retweetCursor = tweetRetweeters.cursor;
        tweetRetweeters = tweetRetweeters.list;
    } catch(e) {
        console.error(e);
        return retweetCursor = undefined;
    }
    let retweetDiv = document.getElementById('retweets');

    if(!c) {
        retweetDiv.innerHTML = '';
        let tweetData = await API.getTweet(id);
        let tweet = await appendTweet(tweetData, retweetDiv, {
            mainTweet: true
        });
        tweet.style.borderBottom = '1px solid var(--border)';
        tweet.style.marginBottom = '10px';
        tweet.style.borderRadius = '5px';
        let h1 = document.createElement('h1');
        h1.innerHTML = `${LOC.retweeted_by.message} (<a href="https://twitter.com/aabehhh/status/${id}/retweets/with_comments">${LOC.see_quotes.message}</a>)`;
        h1.className = 'cool-header';
        retweetDiv.appendChild(h1);
        // h1.getElementsByTagName('a')[0].addEventListener('click', async e => {
        //     e.preventDefault();
        //     history.pushState({}, null, `https://twitter.com/${tweetData.user.screen_name}/status/${id}/retweets/with_comments`);
        //     this.updateSubpage();
        //     this.mediaToUpload = [];
        //     this.linkColors = {};
        //     this.cursor = undefined;
        //     this.seenReplies = [];
        //     this.mainTweetLikers = [];
        //     let tid = location.pathname.match(/status\/(\d{1,32})/)[1];
        //     this.updateRetweetsWithComments(tid);
        //     this.currentLocation = location.pathname;
        // });
    }
    if(!retweetCursor || tweetRetweeters.length === 0) {
        document.getElementById('retweets-more').hidden = true;
    } else {
        document.getElementById('retweets-more').hidden = false;
    }

    for(let i in tweetRetweeters) {
        let u = tweetRetweeters[i];
        let retweetElement = document.createElement('div');
        retweetElement.classList.add('following-item');
        retweetElement.innerHTML = `
        <div>
            <a href="https://twitter.com/${u.screen_name}" class="following-item-link">
                <img src="${u.profile_image_url_https}" alt="${u.screen_name}" class="following-item-avatar tweet-avatar" width="48" height="48">
                <div class="following-item-text">
                    <span class="tweet-header-name following-item-name">${escapeHTML(u.name)}</span><br>
                    <span class="tweet-header-handle">@${u.screen_name}</span>
                </div>
            </a>
        </div>
        <div>
            <button class="following-item-btn nice-button ${u.following ? 'following' : 'follow'}">${u.following ? LOC.following_btn.message : LOC.follow.message}</button>
        </div>`;

        let followButton = retweetElement.querySelector('.following-item-btn');
        followButton.addEventListener('click', async () => {
            if (followButton.classList.contains('following')) {
                await API.unfollowUser(u.screen_name);
                followButton.classList.remove('following');
                followButton.classList.add('follow');
                followButton.innerText = LOC.follow.message;
            } else {
                await API.followUser(u.screen_name);
                followButton.classList.remove('follow');
                followButton.classList.add('following');
                followButton.innerText = LOC.following_btn.message;
            }
        });

        retweetDiv.appendChild(retweetElement);
    }
    document.getElementById('loading-box').hidden = true;
}
async function updateRetweetsWithComments(id, c) {
    let tweetRetweeters;
    try {
        tweetRetweeters = await API.getTweetQuotes(id, c);
        retweetCommentsCursor = tweetRetweeters.cursor;
        tweetRetweeters = tweetRetweeters.list;
    } catch(e) {
        console.error(e);
        return retweetCommentsCursor = undefined;
    }
    let retweetDiv = document.getElementById('retweets_with_comments');

    if(!c) {
        let t = await API.getTweet(id);
        retweetDiv.innerHTML = '';
        let h1 = document.createElement('h1');
        h1.innerHTML = `${LOC.quote_tweets.message} (<a href="https://twitter.com/aabehhh/status/${id}/retweets">${LOC.see_retweets.message}</a>)`;
        h1.className = 'cool-header';
        retweetDiv.appendChild(h1);
        // h1.getElementsByTagName('a')[0].addEventListener('click', async e => {
        //     e.preventDefault();
        //     let t = await API.getTweet(id);
        //     history.pushState({}, null, `https://twitter.com/${t.user.screen_name}/status/${id}/retweets`);
        //     this.updateSubpage();
        //     this.mediaToUpload = [];
        //     this.linkColors = {};
        //     this.cursor = undefined;
        //     this.seenReplies = [];
        //     this.mainTweetLikers = [];
        //     let tid = location.pathname.match(/status\/(\d{1,32})/)[1];
        //     this.updateRetweets(tid);
        //     this.currentLocation = location.pathname;
        // });
    }
    if(!retweetCommentsCursor || tweetRetweeters.length === 0) {
        document.getElementById('retweets_with_comments-more').hidden = true;
    } else {
        document.getElementById('retweets_with_comments-more').hidden = false;
    }

    for(let i in tweetRetweeters) {
        await appendTweet(tweetRetweeters[i], retweetDiv);
    }
    document.getElementById('loading-box').hidden = true;
}

// Render
function renderUserData() {
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('user-name').classList.toggle('user-verified', user.verified);
    document.getElementById('user-name').classList.toggle('user-protected', user.protected);

    document.getElementById('user-handle').innerText = `@${user.screen_name}`;
    document.getElementById('user-tweets-div').href = `https://twitter.com/${user.screen_name}`;
    document.getElementById('user-following-div').href = `https://twitter.com/${user.screen_name}/following`;
    document.getElementById('user-followers-div').href = `https://twitter.com/${user.screen_name}/followers`;
    document.getElementById('user-tweets').innerText = Number(user.statuses_count).toLocaleString().replace(/\s/g, ',');
    if(user.statuses_count >= 100000) {
        let style = document.createElement('style');
        style.innerText = `
            .user-stat-div > h1 { font-size: 18px !important }
            .user-stat-div > h2 { font-size: 13px !important }
        `;
        document.head.appendChild(style);
    }
    document.getElementById('user-following').innerText = Number(user.friends_count).toLocaleString().replace(/\s/g, ',');
    document.getElementById('user-followers').innerText = Number(user.followers_count).toLocaleString().replace(/\s/g, ',');
    document.getElementById('user-banner').src = user.profile_banner_url ? user.profile_banner_url : 'https://abs.twimg.com/images/themes/theme1/bg.png';
    document.getElementById('user-avatar').src = user.profile_image_url_https.replace("_normal", "_400x400");
    document.getElementById('wtf-viewall').href = `https://mobile.twitter.com/i/connect_people?user_id=${user.id_str}`;
    document.getElementById('user-avatar-link').href = `https://twitter.com/${user.screen_name}`;
    document.getElementById('user-info').href = `https://twitter.com/${user.screen_name}`;

    twemoji.parse(document.getElementById('user-name'));
    document.getElementById('loading-box').hidden = true;
}
async function appendComposeComponent(container, replyTweet) {
    if(!replyTweet) return;
    if(!user || !user.screen_name) {
        while(!user || !user.screen_name) {
            await sleep(50);
        }
    }
    tweets.push(['compose', replyTweet]);
    let el = document.createElement('div');
    el.className = 'new-tweet-container';
    el.innerHTML = /*html*/`
        <div id="new-tweet" class="box">
            <img width="35" height="35" class="tweet-avatar" id="new-tweet-avatar">
            <span id="new-tweet-char" hidden>0/280</span>
            <textarea id="new-tweet-text" placeholder="${LOC.reply_to.message} @${replyTweet.user.screen_name}" maxlength="1000"></textarea>
            <div id="new-tweet-user-search" class="box" hidden></div>
            <div id="new-tweet-media-div">
                <span id="new-tweet-media"></span>
            </div>
            <div id="new-tweet-focused" hidden>
                <span id="new-tweet-emojis"></span>
                <div id="new-tweet-media-cc"><div id="new-tweet-media-c"></div></div>
                <button id="new-tweet-button" class="nice-button">${LOC.tweet.message}</button>
                <br><br>
            </div>
        </div>`;
    container.append(el);
    document.getElementById('new-tweet-avatar').src = user.profile_image_url_https.replace("_normal", "_bigger");
    document.getElementById('new-tweet').addEventListener('click', async () => {
        document.getElementById('new-tweet-focused').hidden = false;
        document.getElementById('new-tweet-char').hidden = false;
        document.getElementById('new-tweet-text').classList.add('new-tweet-text-focused');
        document.getElementById('new-tweet-media-div').classList.add('new-tweet-media-div-focused');
    });
    
    document.getElementById('new-tweet').addEventListener('drop', e => {
        handleDrop(e, mediaToUpload, document.getElementById('new-tweet-media-c'));
    });
    document.getElementById('new-tweet').addEventListener('paste', event => {
        let items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (index in items) {
            let item = items[index];
            if (item.kind === 'file') {
                let file = item.getAsFile();
                handleFiles([file], mediaToUpload, document.getElementById('new-tweet-media-c'));
            }
        }
    });
    document.getElementById('new-tweet-media-div').addEventListener('click', async () => {
        getMedia(mediaToUpload, document.getElementById('new-tweet-media-c'));
    });
    let newTweetUserSearch = document.getElementById("new-tweet-user-search");
    let newTweetText = document.getElementById('new-tweet-text');
    let selectedIndex = 0;
    newTweetText.addEventListener('focus', async e => {
        setTimeout(() => {
            if(/(?<!\w)@([\w+]{1,15}\b)$/.test(e.target.value)) {
                newTweetUserSearch.hidden = false;
            } else {
                newTweetUserSearch.hidden = true;
                newTweetUserSearch.innerHTML = '';
            }
        }, 10);
    });
    newTweetText.addEventListener('blur', async e => {
        setTimeout(() => {
            newTweetUserSearch.hidden = true;
        }, 100);
    });
    newTweetText.addEventListener('keypress', async e => {
        if ((e.key === 'Enter' || e.key === 'Tab') && !newTweetUserSearch.hidden) {
            let activeSearch = newTweetUserSearch.querySelector('.search-result-item-active');
            if(!e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                newTweetText.value = newTweetText.value.split("@").slice(0, -1).join('@').split(" ").slice(0, -1).join(" ") + ` @${activeSearch.querySelector('.search-result-item-screen-name').innerText.slice(1)} `;
                if(newTweetText.value.startsWith(" ")) newTweetText.value = newTweetText.value.slice(1);
                newTweetUserSearch.innerHTML = '';
                newTweetUserSearch.hidden = true;
            }
        }
    });
    newTweetText.addEventListener('keydown', async e => {
        if(e.key === 'ArrowDown') {
            if(selectedIndex < newTweetUserSearch.children.length - 1) {
                selectedIndex++;
                newTweetUserSearch.children[selectedIndex].classList.add('search-result-item-active');
                newTweetUserSearch.children[selectedIndex - 1].classList.remove('search-result-item-active');
            } else {
                selectedIndex = 0;
                newTweetUserSearch.children[selectedIndex].classList.add('search-result-item-active');
                newTweetUserSearch.children[newTweetUserSearch.children.length - 1].classList.remove('search-result-item-active');
            }
            return;
        }
        if(e.key === 'ArrowUp') {
            if(selectedIndex > 0) {
                selectedIndex--;
                newTweetUserSearch.children[selectedIndex].classList.add('search-result-item-active');
                newTweetUserSearch.children[selectedIndex + 1].classList.remove('search-result-item-active');
            } else {
                selectedIndex = newTweetUserSearch.children.length - 1;
                newTweetUserSearch.children[selectedIndex].classList.add('search-result-item-active');
                newTweetUserSearch.children[0].classList.remove('search-result-item-active');
            }
            return;
        }
        if(/(?<!\w)@([\w+]{1,15}\b)$/.test(e.target.value)) {
            newTweetUserSearch.hidden = false;
            selectedIndex = 0;
            let users = (await API.search(e.target.value.match(/@([\w+]{1,15}\b)$/)[1])).users;
            newTweetUserSearch.innerHTML = '';
            users.forEach((user, index) => {
                let userElement = document.createElement('span');
                userElement.className = 'search-result-item';
                if(index === 0) userElement.classList.add('search-result-item-active');
                userElement.innerHTML = `
                    <img width="16" height="16" class="search-result-item-avatar" src="${user.profile_image_url_https}">
                    <span class="search-result-item-name ${user.verified ? 'search-result-item-verified' : ''}">${escapeHTML(user.name)}</span>
                    <span class="search-result-item-screen-name">@${user.screen_name}</span>
                `;
                userElement.addEventListener('click', () => {
                    newTweetText.value = newTweetText.value.split("@").slice(0, -1).join('@').split(" ").slice(0, -1).join(" ") + ` @${user.screen_name} `;
                    if(newTweetText.value.startsWith(" ")) newTweetText.value = newTweetText.value.slice(1);
                    newTweetText.focus();
                    newTweetUserSearch.innerHTML = '';
                    newTweetUserSearch.hidden = true;
                });
                newTweetUserSearch.appendChild(userElement);
            });
        } else {
            newTweetUserSearch.innerHTML = '';
            newTweetUserSearch.hidden = true;
        }
        if (e.key === 'Enter') {
            if(e.ctrlKey) document.getElementById('new-tweet-button').click();
        }
    });
    newTweetText.addEventListener('input', async e => {
        let charElement = document.getElementById('new-tweet-char');
        let text = e.target.value.replace(linkRegex, ' https://t.co/xxxxxxxxxx').trim();
        charElement.innerText = `${text.length}/280`;
        if (text.length > 265) {
            charElement.style.color = "#c26363";
        } else {
            charElement.style.color = "";
        }
        if (text.length > 280) {
            tweetReplyChar.style.color = "red";
            document.getElementById('new-tweet-button').disabled = true;
        } else {
            document.getElementById('new-tweet-button').disabled = false;
        }
    });
    document.getElementById('new-tweet-button').addEventListener('click', async () => {
        let tweet = document.getElementById('new-tweet-text').value;
        if (tweet.length === 0 && mediaToUpload.length === 0) return;
        document.getElementById('new-tweet-button').disabled = true;
        let uploadedMedia = [];
        for (let i in mediaToUpload) {
            let media = mediaToUpload[i];
            try {
                media.div.getElementsByClassName('new-tweet-media-img-progress')[0].hidden = false;
                let mediaId = await API.uploadMedia({
                    media_type: media.type,
                    media_category: media.category,
                    media: media.data,
                    alt: media.alt,
                    loadCallback: data => {
                        media.div.getElementsByClassName('new-tweet-media-img-progress')[0].innerText = `${data.text} (${data.progress}%)`;
                    }
                });
                uploadedMedia.push(mediaId);
            } catch (e) {
                media.div.getElementsByClassName('new-tweet-media-img-progress')[0].hidden = true;
                console.error(e);
                alert(e);
            }
        }
        let tweetObject = {
            status: tweet,
            in_reply_to_status_id: replyTweet.id_str,
            auto_populate_reply_metadata: true,
            batch_mode: 'off',
            exclude_reply_user_ids: '',
            cards_platform: 'Web-13',
            include_entities: 1,
            include_user_entities: 1,
            include_cards: 1,
            send_error_codes: 1,
            tweet_mode: 'extended',
            include_ext_alt_text: true,
            include_reply_count: true
        };
        if (uploadedMedia.length > 0) {
            tweetObject.media_ids = uploadedMedia.join(',');
        }
        try {
            let tweet = await API.postTweet(tweetObject);
            tweet._ARTIFICIAL = true;
            appendTweet(tweet, document.getElementById('timeline'), {
                after: document.getElementsByClassName('new-tweet-container')[0]
            });
        } catch (e) {
            document.getElementById('new-tweet-button').disabled = false;
            console.error(e);
        }
        document.getElementById('new-tweet-text').value = "";
        document.getElementById('new-tweet-media-c').innerHTML = "";
        mediaToUpload = [];
        document.getElementById('new-tweet-focused').hidden = true;
        document.getElementById('new-tweet-char').hidden = true;
        document.getElementById('new-tweet-char').innerText = '0/280';
        document.getElementById('new-tweet-text').classList.remove('new-tweet-text-focused');
        document.getElementById('new-tweet-media-div').classList.remove('new-tweet-media-div-focused');
        document.getElementById('new-tweet-button').disabled = false;
    });
    document.getElementById('new-tweet-emojis').addEventListener('click', () => {
        createEmojiPicker(document.getElementById('new-tweet'), newTweetText, {
            marginLeft: '211px',
            marginTop: '-100px'
        });
    });
}

async function appendTombstone(timelineContainer, text) {
    tweets.push(['tombstone', text]);
    let tombstone = document.createElement('div');
    tombstone.className = 'tweet-tombstone';
    tombstone.innerText = text;
    timelineContainer.append(tombstone);
}

// On scroll to end of timeline, load more tweets
let loadingNewTweets = false;
let lastTweetDate = 0;
let activeTweet;

document.addEventListener('clearActiveTweet', () => {
    if(activeTweet) {
        activeTweet.classList.remove('tweet-active');
    }
    activeTweet = undefined;
});
document.addEventListener('findActiveTweet', () => {
    let tweets = Array.from(document.getElementsByClassName('tweet'));
    if(activeTweet) {
        activeTweet.classList.remove('tweet-active');
    }
    let scrollPoint = scrollY + innerHeight/2;
    activeTweet = tweets.find(t => scrollPoint > t.offsetTop && scrollPoint < t.offsetTop + t.offsetHeight);
    if(activeTweet) {
        activeTweet.classList.add('tweet-active');
    }
});

setTimeout(async () => {
    if(!vars) {
        await loadVars();
    }
    // tweet hotkeys
    if(!vars.disableHotkeys) {
        let tle = document.getElementById('timeline');
        document.addEventListener('keydown', async e => {
            if(e.ctrlKey) return;
            // reply box
            if(e.target.className === 'tweet-reply-text') {
                if(e.altKey) {
                    if(e.keyCode === 82) { // ALT+R
                        // hide reply box
                        e.target.blur();
                        let tweetReply = activeTweet.getElementsByClassName('tweet-reply')[0];
                        tweetReply.hidden = true;
                    } else if(e.keyCode === 77) { // ALT+M
                        // upload media
                        let tweetReplyUpload = activeTweet.getElementsByClassName('tweet-reply-upload')[0];
                        tweetReplyUpload.click();
                    } else if(e.keyCode === 70) { // ALT+F
                        // remove first media
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        let tweetReplyMediaElement = activeTweet.getElementsByClassName('tweet-reply-media')[0].children[0];
                        if(!tweetReplyMediaElement) return;
                        let removeBtn = tweetReplyMediaElement.getElementsByClassName('new-tweet-media-img-remove')[0];
                        removeBtn.click();
                    }
                }
            }
            if(e.target.className === 'tweet-quote-text') {
                if(e.altKey) {
                    if(e.keyCode === 81) { // ALT+Q
                        // hide quote box
                        e.target.blur();
                        let tweetReply = activeTweet.getElementsByClassName('tweet-quote')[0];
                        tweetReply.hidden = true;
                    } else if(e.keyCode === 77) { // ALT+M
                        // upload media
                        let tweetQuoteUpload = activeTweet.getElementsByClassName('tweet-quote-upload')[0];
                        tweetQuoteUpload.click();
                    } else if(e.keyCode === 70) { // ALT+F
                        // remove first media
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        let tweetQuoteMediaElement = activeTweet.getElementsByClassName('tweet-quote-media')[0].children[0];
                        if(!tweetQuoteMediaElement) return;
                        let removeBtn = tweetQuoteMediaElement.getElementsByClassName('new-tweet-media-img-remove')[0];
                        removeBtn.click();
                    }
                }
            }
            if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'EMOJI-PICKER') return;
            if(e.keyCode === 83) { // S
                // next tweet
                let ch = [...tle.children].filter(i => i.id !== "new-tweet-container");
                let index = ch.indexOf(activeTweet);
                if(index === -1) return;
                let nextTweet = ch[index + 1];
                if(!nextTweet) return;
                nextTweet.focus();
                nextTweet.scrollIntoView({ block: nextTweet.className.includes('tweet-main') ? 'start' : 'center' });
            } else if(e.keyCode === 87) { // W
                // previous tweet
                let ch = [...tle.children].filter(i => i.id !== "new-tweet-container");
                let index = ch.indexOf(activeTweet);
                if(index === -1) return;
                let nextTweet = ch[index - 1];
                if(!nextTweet) return;
                nextTweet.focus();
                nextTweet.scrollIntoView({ block: nextTweet.className.includes('tweet-main') ? 'start' : 'center' });
            } else if(e.keyCode === 76) { // L
                // like tweet
                if(!activeTweet) return;
                let tweetFavoriteButton = activeTweet.querySelector('.tweet-interact-favorite');
                tweetFavoriteButton.click();
            } else if(e.keyCode === 84) { // T
                // retweet
                if(!activeTweet) return;
                let tweetRetweetButton = activeTweet.querySelector('.tweet-interact-retweet-menu-retweet');
                tweetRetweetButton.click();
            } else if(e.keyCode === 82) { // R
                // open reply box
                if(!activeTweet) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                let tweetReply = activeTweet.getElementsByClassName('tweet-reply')[0];
                let tweetQuote = activeTweet.getElementsByClassName('tweet-quote')[0];
                let tweetReplyText = activeTweet.getElementsByClassName('tweet-reply-text')[0];
                
                tweetReply.hidden = false;
                tweetQuote.hidden = true;
                tweetReplyText.focus();
            } else if(e.keyCode === 81) { // Q
                // open quote box
                if(!activeTweet) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                let tweetReply = activeTweet.getElementsByClassName('tweet-reply')[0];
                let tweetQuote = activeTweet.getElementsByClassName('tweet-quote')[0];
                let tweetQuoteText = activeTweet.getElementsByClassName('tweet-quote-text')[0];
                
                tweetReply.hidden = true;
                tweetQuote.hidden = false;
                tweetQuoteText.focus();
            } else if(e.keyCode === 32) { // Space
                // toggle tweet media
                if(!activeTweet) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                let tweetMedia = activeTweet.getElementsByClassName('tweet-media')[0].children[0];
                if(!tweetMedia) return;
                if(tweetMedia.tagName === "VIDEO") {
                    tweetMedia.paused ? tweetMedia.play() : tweetMedia.pause();
                } else {
                    tweetMedia.click();
                    tweetMedia.click();
                }
            } else if(e.keyCode === 13) { // Enter
                // open tweet
                if(!activeTweet) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                activeTweet.click();
            } else if(e.keyCode === 67 && !e.ctrlKey && !e.altKey) { // C
                // copy image
                if(e.target.className.includes('tweet tweet-id-')) {
                    if(!activeTweet) return;
                    let media = activeTweet.getElementsByClassName('tweet-media')[0];
                    if(!media) return;
                    media = media.children[0];
                    if(!media) return;
                    if(media.tagName === "IMG") {
                        let img = media;
                        let canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        let ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, img.width, img.height);
                        canvas.toBlob((blob) => {
                            navigator.clipboard.write([
                                new ClipboardItem({ "image/png": blob })
                            ]);
                        }, "image/png");
                    }
                }
            } else if(e.keyCode === 68 && !e.ctrlKey && !e.altKey) { // D
                // download media
                if(e.target.className.includes('tweet tweet-id-')) {
                    activeTweet.getElementsByClassName('tweet-interact-more-menu-download')[0].click();
                }
            }
        });
    }
    if(/^\/i\/web\/status\/(\d{5,32})(|\/)$/.test(realPath)) {
        let id = realPath.split("/i/web/status/")[1];
        if (id.endsWith("/")) id = id.slice(0, -1);
        let tweet = await API.getTweet(id);
        location.replace(`https://twitter.com/${tweet.user.screen_name}/status/${id}`);
        return;
    }
    // weird bug
    if(!document.getElementById('wtf-refresh')) {
        location.reload();
    }
    try {
        document.getElementById('wtf-refresh').addEventListener('click', async () => {
            renderDiscovery(false);
        });
    } catch(e) {
        setTimeout(() => {
            location.reload();
        }, 50);
        console.error(e);
        return;
    }
    // Buttons
    document.getElementById('likes-more').addEventListener('click', async () => {
        if(!likeCursor) return;
        let id = location.pathname.match(/status\/(\d{1,32})/)[1];
        updateLikes(id, likeCursor);
    });
    document.getElementById('retweets-more').addEventListener('click', async () => {
        if(!retweetCursor) return;
        let id = location.pathname.match(/status\/(\d{1,32})/)[1];
        updateRetweets(id, retweetCursor);
    });
    document.getElementById('retweets_with_comments-more').addEventListener('click', async () => {
        if(!retweetCommentsCursor) return;
        let id = location.pathname.match(/status\/(\d{1,32})/)[1];
        updateRetweetsWithComments(id, retweetCommentsCursor);
    });

    document.addEventListener('scroll', async () => {
        // find active tweet by scroll amount
        if(Date.now() - lastTweetDate > 50) {
            lastTweetDate = Date.now();
            let tweets = Array.from(document.getElementsByClassName('tweet'));

            let scrollPoint = scrollY + innerHeight/2;
            let newActiveTweet = tweets.find(t => scrollPoint > t.offsetTop && scrollPoint < t.offsetTop + t.offsetHeight);
            if(!activeTweet || (newActiveTweet && !activeTweet.className.startsWith(newActiveTweet.className))) {
                if(activeTweet) {
                    activeTweet.classList.remove('tweet-active');
                }
                if(newActiveTweet) newActiveTweet.classList.add('tweet-active');
                if(vars.autoplayVideos && !document.getElementsByClassName('modal')[0]) {
                    if(activeTweet) {
                        let video = activeTweet.querySelector('.tweet-media > video[controls]');
                        if(video) {
                            video.pause();
                        }
                    }
                    if(newActiveTweet) {
                        let newVideo = newActiveTweet.querySelector('.tweet-media > video[controls]');
                        if(newVideo && !newVideo.ended) {
                            newVideo.play();
                        }
                    }
                }
                activeTweet = newActiveTweet;
            }
        }
    
        // loading new tweets
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 400) {
            if (!cursor || loadingNewTweets) return;
            loadingNewTweets = true;
            let path = location.pathname;
            if(path.endsWith('/')) path = path.slice(0, -1);
            updateReplies(path.split('/').slice(-1)[0], cursor);
        }
    }, { passive: true });    
    
    // Update dates every minute
    setInterval(() => {
        let tweetDates = Array.from(document.getElementsByClassName('tweet-time'));
        let tweetQuoteDates = Array.from(document.getElementsByClassName('tweet-time-quote'));
        let all = [...tweetDates, ...tweetQuoteDates];
        all.forEach(date => {
            date.innerText = timeElapsed(+date.dataset.timestamp);
        });
    }, 60000);

    window.addEventListener("popstate", async () => {
        // document.getElementById('loading-box').hidden = false;
        savePageData(currentLocation);
        updateSubpage();
        mediaToUpload = [];
        linkColors = {};
        cursor = undefined;
        seenReplies = [];
        mainTweetLikers = [];
        let id = location.pathname.match(/status\/(\d{1,32})/)[1];
        let restored = await restorePageData();
        if(subpage === 'tweet' && !restored) {
            updateReplies(id);
        } else if(subpage === 'likes') {
            updateLikes(id);
        } else if(subpage === 'retweets') {
            updateRetweets(id);
        } else if(subpage === 'retweets_with_comments') {
            updateRetweetsWithComments(id);
        }
        renderDiscovery();
        renderTrends();
        currentLocation = location.pathname;
    });

    // Run
    updateUserData();
    updateSubpage();
    let id = location.pathname.match(/status\/(\d{1,32})/)[1];
    if(subpage === 'tweet') {
        try {
            await updateReplies(id);
        } catch(e) {
            console.error(e);
            appendTombstone(document.getElementById('timeline'), LOC.error_loading_tweet.message);
            document.getElementById('loading-box').hidden = true;
        }
    } else if(subpage === 'likes') {
        updateLikes(id);
    } else if(subpage === 'retweets') {
        updateRetweets(id);
    } else if(subpage === 'retweets_with_comments') {
        updateRetweetsWithComments(id);
    }
    renderDiscovery();
    renderTrends();
    setInterval(updateUserData, 60000 * 3);
    setInterval(() => renderDiscovery(false), 60000 * 10);
    setInterval(renderTrends, 60000 * 5);
}, 50);