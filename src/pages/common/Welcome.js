import React from 'react'
import {ext_urls} from 'utils'
import Bowser from 'bowser'
import BlankUser from 'components/BlankUser'
import {meta} from 'pages/about/AddOns'

const chromelike = ['chrome', 'chromium', 'opera', 'edge', 'vivaldi']
const chromelike_fullnames = {}
chromelike.forEach(name => {
  chromelike_fullnames[Bowser.BROWSER_MAP[name]] = true
})

const bp = Bowser.getParser(window.navigator.userAgent)
const browserName = bp.getBrowserName()

export default () => {
  let extension_link = ''
  if (chromelike_fullnames[browserName]) {
    extension_link = <a className='white' target="_blank" href={ext_urls.rt.c}><img alt="Add to Chrome" src={meta.chrome.img}/></a>
  } else if (Bowser.BROWSER_MAP['firefox'] == browserName) {
    extension_link = <a className='white' target="_blank" href={ext_urls.rt.f}><img alt="Add to Firefox" src={meta.firefox.img}/></a>
  }
  return (
    <>
      <BlankUser/>
      <div className='space-around desktop-only' style={{paddingTop: '10px'}}>
        {extension_link}
      </div>
    </>
  )
}
