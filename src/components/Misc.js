import React from 'react'
import {www_reddit} from 'api/reddit'
import { QuestionMark } from 'pages/common/svg'
import ModalContext from 'contexts/modal'
import Bowser from 'bowser'
import {ext_urls} from 'utils'
import {meta} from 'pages/about/AddOns'
import { Link } from 'react-router-dom'

const chromelike = ['chrome', 'chromium', 'opera', 'edge', 'vivaldi']
const chromelike_fullnames = {}
chromelike.forEach(name => {
  chromelike_fullnames[Bowser.BROWSER_MAP[name]] = true
})

const bp = Bowser.getParser(window.navigator.userAgent)
const browserName = bp.getBrowserName()

let browserExtensionImage = ''
if (chromelike_fullnames[browserName]) {
  browserExtensionImage = <img alt="Add to Chrome" src={meta.chrome.img}/>
} else if (Bowser.BROWSER_MAP['firefox'] == browserName) {
  browserExtensionImage = <img alt="Add to Firefox" src={meta.firefox.img}/>
}

const NewWindowLink = ({children, ...props}) => {
  return <a target='_blank' {...props}>{children}</a>
}

export const LinkWithCloseModal = ({children, to}) => {
  const modal = React.useContext(ModalContext)
  return <Link to={to} onClick={modal.closeModal}>{children}</Link>
}

export const ExtensionLink = ({image = false}) => {
  let content = 'Reveddit Real-Time'
  if (image) {
    content = browserExtensionImage
  }
  if (chromelike_fullnames[browserName]) {
    return <NewWindowLink href={ext_urls.rt.c}>{content}</NewWindowLink>
  } else if (Bowser.BROWSER_MAP['firefox'] == browserName) {
    return <NewWindowLink href={ext_urls.rt.f}>{content}</NewWindowLink>
  }
  return <LinkWithCloseModal to='/add-ons/'>{content}</LinkWithCloseModal>
}

export const Spin = ({width}) => {
  const spin = <img className='spin' width={width} src='/images/spin.gif'/>
  if (! width) {
    return <div className='non-item'>{spin}</div>
  }
  return spin
}

export const MessageMods = ({permalink, subreddit}) => {
  const mods_message_body = '\n\n\n'+www_reddit+permalink
  const mods_link = www_reddit+'/message/compose?to=/r/'+subreddit+'&message='+encodeURI(mods_message_body)
  return <a href={mods_link} target="_blank">message mods</a>
}

export const QuestionMarkModal = ({modalContent}) => {
  const modal = React.useContext(ModalContext)
  return (
    <a className='pointer' onClick={() => modal.openModal(modalContent)}>
      <QuestionMark style={{marginLeft: '10px'}} wh='20'/>
    </a>
  )
}
