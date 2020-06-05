import React from 'react'
import { Link } from 'react-router-dom'
import Post from 'pages/common/Post'
import Comment from 'pages/common/Comment'
import LoadLink from './LoadLink'
import Notice from 'pages/common/Notice'
import Selections from 'pages/common/selections'
import scrollToElement from 'scroll-to-element'
import { connect, removedFilter_types } from 'state'
import Time from 'pages/common/Time'
import { withFetch } from 'pages/RevdditFetcher'
import { getQueryParams } from 'data_processing/user'
import { SimpleURLSearchParams, copyLink } from 'utils'
import Highlight from 'pages/common/Highlight'


class User extends React.Component {
  render () {
    const { user, kind = ''} = this.props.match.params
    const { page_type, viewableItems, selections, notShownMsg } = this.props
    const qp_with_defaults = getQueryParams()
    const queryParams = new SimpleURLSearchParams(window.location.search)
    const gs = this.props.global.state
    let loadAllLink = ''
    let nextLink = ''
    let pagesLoaded = ''
    let error = '', status = ''
    let totalPages = 10
    let selectedItems = null
    if (! gs.userNext) {
      totalPages = gs.num_pages
    }

    let linkToRestOfComments = ''
    if (! queryParams.get('after') && ! queryParams.get('limit') && queryParams.get('show')) {
      linkToRestOfComments = window.location.pathname + (new SimpleURLSearchParams(window.location.search)).delete('show')
      selectedItems = queryParams.get('show').split(',')
    }
    if (! gs.loading) {
      if (! qp_with_defaults.after && gs.userNext) {
        loadAllLink = <LoadLink user={user}
                       kind={kind}
                       show={qp_with_defaults.show}
                       loadAll={true}/>
      }
    }
    if (gs.loading) {
      nextLink = <div className='non-item'><img className='spin' src='/images/spin.gif'/></div>
    } else if (gs.userNext) {
      nextLink = <div className='non-item'>
        <LoadLink user={user}
         kind={kind}
         show={qp_with_defaults.show}
         loadAll={false}/></div>
    } else if (gs.userIssueDescription) {
      error = <div className='non-item text' dangerouslySetInnerHTML={{ __html: user +' '+ gs.userIssueDescription }}></div>
    }
    if (gs.items.length) {
      pagesLoaded = <React.Fragment>
                      <div id='pagesloaded' className='non-item text' data-pagesloaded={gs.num_pages}>loaded pages {`${gs.num_pages}/${totalPages}`}</div>
                    </React.Fragment>
    } else if (! gs.loading) {
      status = <p>No comments or posts are available for this user.</p>
    }

    const shownItems = []
    const removedCommentIDs = []
    viewableItems.forEach(item => {
      if (! selectedItems || (selectedItems && selectedItems.includes(item.name))) {
        if (item.name.slice(0,2) === 't3') {
          shownItems.push(<Post key={item.name} {...item} sort={qp_with_defaults.sort} />)
        } else {
          shownItems.push(<Comment key={item.name} {...item} sort={qp_with_defaults.sort} kind={kind}/>)
          if (item.removed) {
            removedCommentIDs.push(item.name)
          }
        }
      }
    })
    const shareLink = window.location.pathname.replace(/^\/user/,'/y')+window.location.search+window.location.hash

    return (
      <>
        <div className='userpage'>
          <div className='top'>
            <div className='top-selections'>
              <div id="buttons-right">
                <div><a href={shareLink} onClick={copyLink}>copy sharelink</a></div>
                <div>{loadAllLink}</div>
              </div>
              {selections}
            </div>
            <Highlight/>
            {notShownMsg}
            { removedCommentIDs.length > 0 &&
              <Notice message="Some comments have been removed. To view this on reddit, open the below link in an incognito window or while logged out."
                htmlLink={<a href={'https://www.reddit.com/api/info?id='+removedCommentIDs.join(',')} target="_blank">view removed comments on reddit</a>}
              />
            }
            {! gs.hasVisitedUserPage_sortTop &&
              <Notice message="Sorting by top may show more results."
                htmlLink={<a href={'?sort=top&all=true'}>sort by top</a>}
              />
            }
            {gs.hasVisitedUserPage_sortTop && ! gs.hasVisitedSubredditPage &&
              <Notice message="Subreddit pages work too."
                htmlLink={<Link to={'/r/'}>view a subreddit</Link>}
              />
            }
            {gs.hasVisitedUserPage_sortTop && gs.hasVisitedSubredditPage && ! gs.hasClickedRemovedUserCommentContext &&
              <Notice message={
                <div><span class="quarantined">Tip</span> The context links of removed comments now show the comment in context even if the comment was not archived.</div>
              }/>
            }
            {selectedItems &&
              <Notice message="showing selected items."
                htmlLink={<Link to={linkToRestOfComments}>view all items</Link>}
              />
            }
            {
              shownItems
            }
            {error}
            {status}
          </div>
          <div className='footer'>
            {pagesLoaded}
            {nextLink}
          </div>
        </div>
      </>
    )
  }
}

export default connect(withFetch(User))
