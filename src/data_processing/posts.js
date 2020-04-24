import { getPosts as getRedditPosts,
         getPostsForURLs as getRedditPostsForURLs,
         querySearch as queryRedditSearch } from 'api/reddit'
import { getAuth } from 'api/reddit/auth'
import {
  getPostsBySubredditOrDomain as pushshiftGetPostsBySubredditOrDomain,
  queryPosts as pushshiftQueryPosts,
  getPost as getPushshiftPost
} from 'api/pushshift'
import { itemIsRemovedOrDeleted, postIsDeleted, display_post,
         getUniqueItems, SimpleURLSearchParams, parse, replaceAmpGTLT
} from 'utils'
import { REMOVAL_META, ANTI_EVIL_REMOVED, AUTOMOD_REMOVED, AUTOMOD_REMOVED_MOD_APPROVED,
         MOD_OR_AUTOMOD_REMOVED, UNKNOWN_REMOVED, NOT_REMOVED, USER_REMOVED,
         AUTOMOD_LATENCY_THRESHOLD } from 'pages/common/RemovedBy'

export const byScore = (a, b) => {
  return (b.stickied - a.stickied) || (b.score - a.score)
      || (b.num_comments - a.num_comments)
}
export const byDate = (a, b) => {
  return (b.stickied - a.stickied) || (b.created_utc - a.created_utc)
      || (b.num_comments - a.num_comments)
}
export const byNumComments = (a, b) => {
  return (b.stickied - a.stickied) || (b.num_comments - a.num_comments)
      || (b.created_utc - a.created_utc)
}
export const byControversiality = (a, b) => {
  return (b.stickied - a.stickied) || (a.score - b.score)
      || (b.num_comments - a.num_comments)
}
export const byNumCrossposts = (a, b) => {
  if ('num_crossposts' in a && 'num_crossposts' in b) {
    return (b.num_crossposts - a.num_crossposts) || (b.num_comments - a.num_comments)
        || (b.created_utc - a.created_utc)
  } if ('num_crossposts' in a) {
    return -1
  } else if ('num_crossposts' in b) {
    return 1
  } else {
    return (b.created_utc - a.created_utc)
  }
}

export const retrieveRedditPosts_and_combineWithPushshiftPosts = (
  {pushshiftPosts, includePostsWithZeroComments = false, existingRedditPosts = {},
   subreddit_about_promise = Promise.resolve({})}) => {
  const ids = []
  pushshiftPosts.forEach(post => {
    if (!(post.id in existingRedditPosts)) {
      ids.push(post.id)
    }
  })
  return getRedditPosts({ids})
  .then(redditPosts => {
    Object.values(existingRedditPosts).forEach(post => {
      redditPosts[post.id] = post
    })
    return combinePushshiftAndRedditPosts({pushshiftPosts, redditPosts: Object.values(redditPosts),
      includePostsWithZeroComments, subreddit_about_promise})
  })
}

export const getRevdditPosts = (pushshiftPosts) => {
  return retrieveRedditPosts_and_combineWithPushshiftPosts({pushshiftPosts})
}

export const combinePushshiftAndRedditPosts = async (
  {pushshiftPosts, redditPosts, includePostsWithZeroComments = false, isInfoPage = false,
  subreddit_about_promise = Promise.resolve({})}) => {
  const subredditAbout = await subreddit_about_promise || {}
  const redditPosts_lookup = {}
  redditPosts.forEach(post => {
    redditPosts_lookup[post.id] = post
  })
  const pushshiftPosts_lookup = {}
  const missingPosts = []
  pushshiftPosts.forEach(post => {
    pushshiftPosts_lookup[post.id] = post
    if (! redditPosts_lookup[post.id]) {
      missingPosts.push(post.id)
    }
  })
  if (missingPosts.length) {
    console.log('missing posts: '+missingPosts.join(' '))
  }
  const show_posts = []
  redditPosts.forEach(reddit_post => {
    const ps_post = pushshiftPosts_lookup[reddit_post.id]
    const post = combineRedditAndPushshiftPost(reddit_post, ps_post)
    post.selftext = ''
    if (post.deleted || post.removed) {
      if (  (    post.num_comments > 0
              || includePostsWithZeroComments
              || post.removed)
            && ! subredditAbout.over18) {
        display_post(show_posts, post, ps_post, isInfoPage)
      }
    } else {
      show_posts.push(post)
    }
  })
  return show_posts
}

export const combineRedditAndPushshiftPost = (post, ps_post) => {
  let retrievalLatency = undefined
  if (ps_post) {
    retrievalLatency = ps_post.retrieved_on-ps_post.created_utc
  }
  if (post.crosspost_parent_list) {
    post.num_crossposts += post.crosspost_parent_list.reduce((total,x) => total+x.num_crossposts,0)
  }
  if (itemIsRemovedOrDeleted(post)) {
    if (postIsDeleted(post)) {
      post.deleted = true
      post.selftext = ''
      post.removedby = USER_REMOVED
    } else {
      post.removed = true
      if (post.removed_by_category === 'anti_evil_ops') {
        post.removedby = ANTI_EVIL_REMOVED
      } else if (ps_post && 'is_robot_indexable' in ps_post && ! ps_post.is_robot_indexable) {
        if (retrievalLatency !== undefined && retrievalLatency <= AUTOMOD_LATENCY_THRESHOLD) {
          post.removedby = AUTOMOD_REMOVED
        } else {
          post.removedby = UNKNOWN_REMOVED
        }
      } else if (! ps_post || ! ('is_robot_indexable' in ps_post)) {
        post.removedby = UNKNOWN_REMOVED
      } else {
        post.removedby = MOD_OR_AUTOMOD_REMOVED
      }
    }
  } else {
    if (ps_post && 'is_robot_indexable' in ps_post && ! ps_post.is_robot_indexable) {
      post.removedby = AUTOMOD_REMOVED_MOD_APPROVED
    } else {
      post.removedby = NOT_REMOVED
    }
  }
  return post
}

const reduceDomain = (map, e) => {
  if (e.split('.').length > 1) {
    map[e] = 1
    const base = e.replace(/^www\./i,'')
    map[base] = 1
    if (base.split('.').length-1 == 1) {
      map['www.'+base] = 1
    }
    if (base in youtube_aliases) {
      Object.keys(youtube_aliases).forEach(alias => {
        map[alias] = 1
      })
    }
  }
  return map
}

export const getRevdditPostsByDomain = (domain, global) => {
  const {n, before, before_id, selfposts} = global.state
  global.setLoading('')
  if (window.location.pathname.match(/^\/r\/([^/]*)\/.+/g)) {
    window.history.replaceState(null,null,`/r/${domain}/`+window.location.search)
  }
  const domains = Object.keys(domain.split('+').reduce(reduceDomain, {}))
  if (domains.length) {
    const promises = [pushshiftGetPostsBySubredditOrDomain({domain:domains.join('+'), n, before, before_id})]
    const addQuery = selfposts && domains.length
    if (addQuery) {
      promises.push(pushshiftQueryPosts({selftext:domains.join('|')}))
    }
    return Promise.all(promises)
    .then(results => {
      if (addQuery) {
        return results[0].concat(results[1])
      } else {
        return results[0]
      }
    })
    .then(pushshiftPosts => retrieveRedditPosts_and_combineWithPushshiftPosts({pushshiftPosts}))
    .then(show_posts => {
      global.setSuccess({items:show_posts})
      return show_posts
    })
  } else {
    global.setError('')
  }
}

const getMinimalPostPath = (path, shortest=false) => {
  let start = 0
  if (shortest) {
    start = 3
  }
  return path.split('/').slice(start, 5).join('/')
}

const youtube_suffix = '/watch?v='

const youtube_aliases = {
  'youtu.be':'/',
  'www.youtube.com':youtube_suffix,
  'youtube.com':youtube_suffix,
  'm.youtube.com':youtube_suffix
}

const getYoutubeURL_pushshift = (id) => {
  return `((${Object.keys(youtube_aliases).join('|')}) "${id}")`
}

const getYoutubeURLs = (id) => {
  return Object.keys(youtube_aliases).map(x => 'https://'+x+youtube_aliases[x]+id)
}
const noHTTP = (u) => {
  return u.replace(/^https?:\/\//,'')
}

const getUrlMeta = (url) => {
  const url_nohttp = noHTTP(url)
  const redditlikeDomainStripped = url_nohttp.replace(/^[^/]*(reddit\.com|removeddit\.com|ceddit\.com|unreddit\.com|snew\.github\.io|snew\.notabug\.io|politicbot\.github\.io|r\.go1dfish\.me|reve?ddit\.com)/i,'')
  const isRedditDomain = redditlikeDomainStripped.match(/^\//)
  const isRedditPostURL = redditlikeDomainStripped.match(/^\/r\/[^/]*\/comments\/[a-z0-9]/i)
  let pushshift_urls = [url_nohttp]
  let reddit_info_url = [url]
  let reddit_search_selftext = [url_nohttp]
  let reddit_search_url = []
  const isYoutubeURL = url.match(/^https?:\/\/(?:www\.|m\.)?(youtube\.com|youtu\.be)\/(.+)/i)
  if (isRedditPostURL) {
    const minPostPath = getMinimalPostPath(redditlikeDomainStripped)
    pushshift_urls = [minPostPath]
    reddit_search_selftext = [getMinimalPostPath(redditlikeDomainStripped, true)]
    reddit_search_url = [minPostPath]
  } else if (isYoutubeURL && isYoutubeURL[2]) {
    let id = ''
    if (isYoutubeURL[1] === 'youtube.com') {
      const params = new SimpleURLSearchParams(isYoutubeURL[2].split('?')[1])
      id = params.get('v')
    } else {
      id = isYoutubeURL[2].split('?')[0]
    }
    if (id) {
      pushshift_urls = [getYoutubeURL_pushshift(id)]
      const full_yt_urls = getYoutubeURLs(id)
      reddit_info_url.push(...full_yt_urls)
      reddit_search_selftext.push(...full_yt_urls)
    }
  }
  const postURL_ID = redditlikeDomainStripped.split('/')[4]
  return {isRedditDomain, isRedditPostURL, pushshift_urls, postURL_ID,
          reddit_info_url, reddit_search_selftext, reddit_search_url}
}

class SearchInput {
  constructor(meta = {}) {
    this.pushshift_urls = [...meta.pushshift_urls || []]
    this.pushshift_selftext_urls = [...meta.pushshift_urls || []] // using same value as pushshift_urls is intentional
    this.reddit_info_url = [...meta.reddit_info_url || []] // api/info?url=
    this.reddit_search_selftext = [...meta.reddit_search_selftext || []] // /search?q=selftext:
    this.reddit_search_url = [...meta.reddit_search_url || []] // /search?url=
  }
}

export const getRevdditDuplicatePosts = async (threadID, global) => {
  global.setLoading('')
  const auth = await getAuth()
  const drivingPosts_ids = threadID.split('+')
  return await getRedditPosts({ids: drivingPosts_ids, auth})
  .then(async redditPosts => {
    const searchInput = new SearchInput()
    const secondary_lookup_ids_set = {}
    for (const drivingPost of Object.values(redditPosts)) {
      let firstLink = ''
      let meta
      if (drivingPost.selftext) {
        let selftext = drivingPost.selftext
        if (drivingPost.is_robot_indexable === false) {
          const ps_drivingPost = await getPushshiftPost(drivingPost.id)
          .catch(() => {}) // this ps query may fail while later ps/reddit queries succeed
          if (ps_drivingPost) {
            selftext = ps_drivingPost.selftext
          }
        }
        const matches = parse(selftext).match(/<a href="([^"]+)">/)
        if (matches && matches.length > 1) {
          firstLink = replaceAmpGTLT(matches[1])
        }
      }
      if (firstLink) {
        meta = getUrlMeta(firstLink)
      } else {
        meta = getUrlMeta(drivingPost.url)
      }
      searchInput.pushshift_urls.push(...meta.pushshift_urls)
      searchInput.reddit_info_url.push(...meta.reddit_info_url)
      searchInput.reddit_search_selftext.push(...meta.reddit_search_selftext)
      searchInput.reddit_search_url.push(...meta.reddit_search_url)
      if (meta.isRedditPostURL) {
        if (! drivingPosts_ids.includes(meta.postURL_ID)) {
          secondary_lookup_ids_set[meta.postURL_ID] = true
        }
      } else {
        const minimalPostPath = getMinimalPostPath(drivingPost.permalink)
        searchInput.pushshift_urls.push(minimalPostPath)
        searchInput.pushshift_selftext_urls.push(minimalPostPath)
        searchInput.reddit_search_selftext.push(getMinimalPostPath(drivingPost.permalink, true))
        searchInput.reddit_search_url.push(minimalPostPath)
      }
      if (! meta.isRedditDomain || meta.isRedditPostURL) {
        searchInput.pushshift_selftext_urls.push(...meta.pushshift_urls)
      }
    }
    const secondary_lookup_ids = Object.keys(secondary_lookup_ids_set)
    if (secondary_lookup_ids.length) {
      Object.values(await getRedditPosts({ids: secondary_lookup_ids, auth})).forEach(secondary_post => {
        const meta = getUrlMeta(secondary_post.url)
        if (meta.isRedditPostURL) {
          searchInput.pushshift_urls.push(...meta.pushshift_urls)
          searchInput.reddit_info_url.push(...meta.reddit_info_url)
          searchInput.reddit_search_selftext.push(...meta.reddit_search_selftext)
          searchInput.reddit_search_url.push(...meta.reddit_search_url)
        } else {
          searchInput.pushshift_urls.push(secondary_post.url)
          searchInput.reddit_info_url.push(secondary_post.url)
          searchInput.reddit_search_selftext.push(secondary_post.url)
        }
      })
    }
    return searchRedditAndPushshiftPosts(global, searchInput)
  })
}

export const getPostsByURL = (global, url) => {
  const meta = getUrlMeta(url)
  if (meta.isRedditPostURL) {
    return getRevdditDuplicatePosts(meta.postURL_ID, global)
  } else {
    const searchInput = new SearchInput(meta)
    return searchRedditAndPushshiftPosts(global, searchInput)
  }
}

const getPushshiftURLString = (urls) => {
  return urls.map(u => {
    if (u.match(/^\(/)) {
      return u
    } else {
      return '"'+u+'"'
    }
  }).join('|')
}


const searchRedditAndPushshiftPosts = (global, searchInput) => {
  const pushshift_promises = [], reddit_promises = []
  const {reddit_info_url, reddit_search_selftext, reddit_search_url,
  pushshift_urls, pushshift_selftext_urls} = searchInput

  if (reddit_info_url.length) {
    reddit_promises.push(getRedditPostsForURLs(reddit_info_url))
  }
  if (reddit_search_selftext.length) {
    reddit_promises.push(queryRedditSearch({selftexts: reddit_search_selftext}))
  }
  if (reddit_search_url.length) {
    reddit_promises.push(queryRedditSearch({urls: reddit_search_url}))
  }
  if (pushshift_urls.length) {
    pushshift_promises.push(
      pushshiftQueryPosts({url: getPushshiftURLString(pushshift_urls)}
    ))
  }
  if (pushshift_selftext_urls.length) {
    pushshift_promises.push(
      pushshiftQueryPosts(
        {selftext: getPushshiftURLString(pushshift_selftext_urls)}
      ))
  }
  return Promise.all(reddit_promises).then(reddit_results => {
    const redditPosts = {}
    reddit_results.forEach(posts => {
      Object.values(posts).forEach(post => {
        redditPosts[post.id] = post
      })
    })
    return combinePushshiftAndRedditPosts({
      pushshiftPosts: [],
      redditPosts: Object.values(redditPosts),
      includePostsWithZeroComments: true})
    .then(items => {
      global.setState({items})
      return Promise.all(pushshift_promises)
      .then(pushshift_results => {
        if (pushshift_results.length === 1) {
          return pushshift_results[0]
        } else {
          return getUniqueItems(pushshift_results)
        }
      })
    })
    .then((pushshiftPosts) => {
      return retrieveRedditPosts_and_combineWithPushshiftPosts(
        {pushshiftPosts, includePostsWithZeroComments: true, existingRedditPosts:redditPosts})
    })
  })
  .then(items => {
    global.setSuccess({items})
    return items
  })
}
