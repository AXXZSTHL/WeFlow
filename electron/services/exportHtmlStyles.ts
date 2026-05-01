export const EXPORT_HTML_STYLES = `/* 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲
   WeFlow 鈥?HTML Export Style Sheet
   Modelled after WeChatMsg HTML export style
   鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲 */

/* 鈹€鈹€ Reset & Base 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%;
  font-family: "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
  background: #ededed;
  color: #1a1a1a;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,.2); border-radius: 3px; }

/* 鈹€鈹€ Page Layout 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.page {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  box-shadow: 1px 1px 3px #ebebeb;
  border-radius: 5px;
  overflow: hidden;
}

/* 鈹€鈹€ Left Timeline Sidebar 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.mid-bar {
  width: 280px;
  background: #f7f7f7;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  --left: 58%;
  --color: #07c160;
}

.timeline-area {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
}

.timeline-wrapper {
  padding: 20% 0;
}

.timeline {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.timeline::before {
  content: "";
  position: absolute;
  left: var(--left);
  width: 1px;
  height: 100%;
  top: 0;
  background-image: linear-gradient(to bottom, rgba(144,156,173,.5) 60%, rgba(255,255,255,0) 0%);
  background-position: left;
  background-size: 1px 5px;
  background-repeat: repeat-y;
}

.timeline-item-year {
  height: 40px;
  position: relative;
  display: flex;
  cursor: pointer;
}
.timeline-item-year:hover .timeline-right { color: #07c160; }

.timeline-item-month {
  height: 25px;
  display: flex;
  cursor: pointer;
}
.timeline-item-month:hover .timeline-right { color: #07c160; }

.timeline-dot-year, .timeline-dot-month {
  left: var(--left);
  position: relative;
  border-radius: 50%;
  text-align: center;
  top: 50%;
  transform: translateY(-50%);
}
.timeline-dot-year {
  width: 10px; height: 10px;
  background: #333;
  margin-left: -4.5px;
  flex-shrink: 0;
}
.timeline-dot-month {
  width: 7px; height: 7px;
  background: #fff;
  box-shadow: 0 0 0 1px #d8d8d8;
  margin-left: -3px;
  flex-shrink: 0;
}
.timeline-item-month.current .timeline-dot-month {
  background: var(--color);
  box-shadow: 0 0 4px var(--color);
  border: 1px solid #fff;
}

.timeline-item-month .timeline-right,
.timeline-item-year .timeline-right {
  position: relative;
  margin-left: 10px;
  font-size: 13px;
  color: #555;
  line-height: 40px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.timeline-item-month .timeline-right { line-height: 25px; }
.no-msg-month .timeline-dot-month {
  background: #e0e0e0;
  box-shadow: 0 0 0 1px #ccc;
  opacity: 0.5;
}
.no-msg-month .timeline-right { color: #ccc; font-style: italic; }
.no-msg-month { cursor: default !important; }

/* Timeline month message count */
.tl-count {
  display: inline-block;
  margin-left: 4px;
  font-size: 10px;
  color: #aaa;
  vertical-align: middle;
  line-height: 1;
}

/* 鈹€鈹€ Main Body 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.main-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  overflow: hidden;
}

/* 鈹€鈹€ Title Bar 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.title-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #f7f7f7;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
  gap: 10px;
  min-height: 52px;
}

.title-bar .session-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Filter tabs */
.filter-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 3px 9px;
  border: 1px solid #dcdfe3;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  background: rgba(255,255,255,.88);
  color: #555;
  transition: all .15s;
  user-select: none;
  white-space: nowrap;
}
.filter-tab .tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  background: rgba(0,0,0,.08);
  border-radius: 999px;
  font-size: 10px;
  line-height: 16px;
  font-weight: 600;
}
.filter-tab.active .tab-count {
  background: rgba(255,255,255,.28);
  color: #fff;
}
.filter-tab:hover { border-color: #07c160; color: #07c160; background: #f6fff9; }
.filter-tab.active { background: #07c160; border-color: #07c160; color: #fff; box-shadow: 0 2px 8px rgba(7,193,96,.22); }

/* Search area */
.search-area {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.search-area input[type="search"] {
  height: 28px;
  border: 1px solid #d0d0d0;
  border-radius: 14px;
  padding: 0 12px;
  font-size: 12px;
  outline: none;
  width: 140px;
  background: #fff;
  transition: border-color .2s;
}
.search-area input[type="search"]:focus { border-color: #07c160; }
.search-area button {
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: #07c160;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.search-area button:hover { background: #06ad56; }
.time-jump-area {
  display: flex;
  align-items: center;
  gap: 4px;
}
.time-jump-area input[type="datetime-local"] {
  height: 28px;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  padding: 0 6px;
  font-size: 12px;
  outline: none;
  background: #fff;
}

/* 鈹€鈹€ Chat Container 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.container {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
  -webkit-overflow-scrolling: touch;
}
.content:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,.18); }

/* 鈹€鈹€ Nav Bar (Pagination) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 8px 14px;
  background: rgba(247,247,247,.96);
  border-top: 1px solid #e5e8eb;
  box-shadow: 0 -3px 12px rgba(0,0,0,.03);
  flex-shrink: 0;
}
.turner-bar {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid #e4e7ea;
  border-radius: 999px;
  background: #fff;
  font-size: 13px;
  color: #555;
  user-select: none;
  box-shadow: 0 2px 10px rgba(0,0,0,.04);
}
.page-btn {
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: #f0f2f4;
  color: #333;
  cursor: pointer;
  font-size: 12px;
  transition: all .15s;
}
.page-btn:hover:not(:disabled) {
  background: #07c160;
  color: #fff;
  box-shadow: 0 2px 8px rgba(7,193,96,.22);
}
.page-btn:disabled {
  cursor: not-allowed;
  color: #bbb;
  background: #f6f6f6;
}
.page-jump {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #555;
  white-space: nowrap;
}
.turner-bar .navgator {
  width: 44px;
  height: 28px;
  text-align: center;
  border: 1px solid #d9dde1;
  border-radius: 8px;
  background: #fafafa;
  color: #111;
  font-size: 13px;
  font-weight: 600;
  outline: 0;
}
.turner-bar .navgator:focus {
  border-color: #07c160;
  background: #fff;
  box-shadow: 0 0 0 2px rgba(7,193,96,.12);
}
.page-count {
  padding-left: 2px;
  color: #888;
  white-space: nowrap;
}

/* 鈹€鈹€ Message Items 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.item {
  margin-top: 14px;
  display: flex;
  width: 100%;
}
.item-refer { margin-top: 4px; }
.item.item-right { justify-content: flex-end; }
.item.item-center {
  justify-content: center;
  margin-top: 8px;
}
.item.item-center span {
  display: inline-block;
  padding: 2px 10px;
  background: rgba(0,0,0,.12);
  color: #fff;
  border-radius: 10px;
  font-size: 12px;
  user-select: none;
}

/* Avatar */
.avatar img {
  width: 42px;
  height: 42px;
  border-radius: 4px;
  object-fit: cover;
  display: block;
  user-select: none;
  background: #ccc;
}
.avatar-placeholder {
  width: 42px;
  height: 42px;
  border-radius: 4px;
  background: #c8c8c8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

/* Content wrapper */
.content-wrapper {
  display: flex;
  flex-direction: column;
  max-width: 55%;
}
.content-wrapper-left { align-items: flex-start; }
.content-wrapper-right { align-items: flex-end; }

/* Display name */
.displayname {
  font-size: 12px;
  color: #888;
  margin-bottom: 3px;
  padding: 0 14px;
}

/* 鈹€鈹€ Bubble 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.bubble {
  position: relative;
  max-width: 100%;
  word-wrap: break-word;
  word-break: break-word;
  white-space: pre-wrap;
  padding: 9px 12px;
  border-radius: 5px;
  color: #1f1f1f;
  font-size: 14px;
  line-height: 1.6;
}
/* Triangle arrows */
.item-left .bubble, .item-left .bubble-left {
  margin-left: 12px;
  background: #fff;
  border-radius: 0 5px 5px 5px;
}
.item-left .bubble::before, .item-left .bubble-left::before {
  content: "";
  position: absolute;
  left: -8px; top: 10px;
  border: 5px solid transparent;
  border-right: 8px solid #fff;
  border-left: none;
}
.item-right .bubble, .item-right .bubble-right {
  margin-right: 12px;
  background: #95ec69;
  border-radius: 5px 0 5px 5px;
}
.item-right .bubble::before, .item-right .bubble-right::before {
  content: "";
  position: absolute;
  right: -8px; top: 10px;
  border: 5px solid transparent;
  border-left: 8px solid #95ec69;
  border-right: none;
}

/* 鈹€鈹€ Quoted / Reply 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.chat-refer {
  max-width: 400px;
  margin-top: 4px;
  padding: 7px 10px;
  border-radius: 3px;
  color: #797979;
  font-size: 12px;
  background: #e8e8e8;
  word-break: break-word;
  white-space: pre-wrap;
}
.chat-refer-right { margin-right: 15px; }
.chat-refer-left  { margin-left: 15px; }

/* 鈹€鈹€ Media: Image / Emoji 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.chat-image, .emoji-image {
  margin-left: 12px;
  margin-right: 12px;
}
.item-right .chat-image, .item-right .emoji-image { margin-right: 14px; }

.chat-image img {
  max-width: 250px;
  max-height: 250px;
  border-radius: 4px;
  cursor: zoom-in;
  display: block;
  object-fit: contain;
  background: #f0f0f0;
}
.emoji-image img {
  max-width: 150px;
  max-height: 150px;
  border-radius: 4px;
  cursor: zoom-in;
  display: block;
}

/* Placeholder for missing image/video/emoji/voice */
.chat-image-placeholder,
.chat-video-placeholder,
.emoji-image-placeholder,
.chat-audio-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #f0f0f0;
  border-radius: 6px;
  color: #999;
  font-size: 13px;
  user-select: none;
  min-width: 80px;
  max-width: 200px;
}
.chat-image-placeholder svg,
.chat-video-placeholder svg,
.chat-audio-placeholder svg { flex-shrink: 0; opacity: 0.6; }
.chat-video-placeholder {
  background: rgba(0,0,0,.08);
}
.chat-audio-placeholder {
  background: #fff;
  border: 1px solid #e0e0e0;
  color: #666;
}

/* 鈹€鈹€ Media: Audio / Video 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.chat-audio {
  max-width: 360px;
  margin: 0 12px;
}
audio { display: block; width: 260px; max-width: 100%; }
.chat-video { margin: 0 12px; }
.chat-video video {
  max-width: 320px;
  max-height: 240px;
  border-radius: 4px;
  background: #000;
  display: block;
}

/* 鈹€鈹€ File Card 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.chat-file {
  max-width: 300px;
  margin: 0 12px;
  display: flex;
  flex-direction: column;
  padding: 10px;
  background: #fff;
  border-radius: 5px;
  cursor: pointer;
}
.chat-file .file-box {
  display: flex;
  align-items: center;
  gap: 8px;
}
.chat-file .file-img img {
  width: 40px;
  height: 40px;
  object-fit: contain;
}
.chat-file .file-info { flex: 1; min-width: 0; }
.chat-file .file-name {
  font-size: 13px;
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.chat-file .file-size {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

/* 鈹€鈹€ Forwarded Chat Record Card 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.merge-message {
  position: relative;
  width: 240px;
  border-radius: 5px;
  background: #fff;
  margin: 0 12px;
  cursor: pointer;
  overflow: hidden;
}
.merge-message:hover { background: #f5f5f5; }
.merge-message .title {
  margin: 10px 14px 4px;
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.merge-message .msg {
  margin: 2px 14px;
  font-size: 12px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.merge-message .bottom {
  margin-top: 8px;
  padding: 6px 14px;
  font-size: 12px;
  color: #888;
  background: #f5f5f5;
  border-top: 1px solid #eee;
}
/* Arrows for merge-message */
.item-left .merge-message::before {
  content: "";
  position: absolute;
  left: -8px; top: 10px;
  border: 5px solid transparent;
  border-right: 8px solid #fff;
  border-left: none;
}
.item-right .merge-message::before {
  content: "";
  position: absolute;
  right: -8px; top: 10px;
  border: 5px solid transparent;
  border-left: 8px solid #fff;
  border-right: none;
}

/* 鈹€鈹€ Location Card 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.location {
  position: relative;
  width: 230px;
  border-radius: 5px;
  background: #fff;
  margin: 0 12px;
  overflow: hidden;
}
.location .poiname {
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 500;
  word-break: break-word;
}
.location .label {
  padding: 0 10px 6px;
  font-size: 12px;
  color: #888;
  word-break: break-word;
}
.location .map {
  width: 100%;
  height: 110px;
  overflow: hidden;
  background: #eee;
}
.location .map img { width: 100%; height: 100%; object-fit: cover; }
.item-left .location::before {
  content: "";
  position: absolute;
  left: -8px; top: 10px;
  border: 5px solid transparent;
  border-right: 8px solid #fff;
  border-left: none;
}
.item-right .location::before {
  content: "";
  position: absolute;
  right: -8px; top: 10px;
  border: 5px solid transparent;
  border-left: 8px solid #fff;
  border-right: none;
}

/* 鈹€鈹€ Link Card 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.card {
  background: #fff;
  border-radius: 6px;
  overflow: hidden;
  max-width: 280px;
  width: 280px;
  margin: 0 14px;
  display: flex;
  flex-direction: column;
  text-align: left;
}
.card a { text-decoration: none; color: inherit; }
.card-content { padding: 10px; flex: 1; }
.card-content h2 {
  font-size: 13px;
  font-weight: 600;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: #1a1a1a;
}
.description { display: flex; justify-content: space-between; margin-top: 4px; }
.description p {
  font-size: 12px;
  color: #888;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
  margin-right: 8px;
}
.thumbnail {
  width: 50px; height: 50px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}
.link-info {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  background: #f5f5f5;
  gap: 6px;
}
.app-logo {
  width: 16px; height: 16px;
  border-radius: 50%;
  object-fit: cover;
}
.app-name { font-size: 11px; color: #888; }

/* 鈹€鈹€ Emoji Inline 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.emoji_img {
  width: 22px; height: 22px;
  vertical-align: -5px;
  margin: 0 1px;
}

/* 鈹€鈹€ Inline Call record 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.call { font-size: 13px; color: #666; }

/* 鈹€鈹€ Forwarded Chat Record MODAL 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.merge-msg-modal {
  display: none;
  position: fixed;
  z-index: 9998;
  inset: 0;
  background: rgba(0,0,0,.45);
}
.merge-msg-modal.open { display: flex; align-items: center; justify-content: center; }
.merge-msg-modal-content {
  background: #fff;
  border-radius: 8px;
  width: 620px;
  max-width: 95vw;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,.25);
}
.merge-msg-modal-content .modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}
.merge-msg-modal-content .modal-header h3 {
  font-size: 14px;
  color: #666;
  font-weight: 400;
}
.merge-msg-modal-content .close {
  font-size: 22px;
  color: #aaa;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}
.merge-msg-modal-content .close:hover { color: #333; }
.modal-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.modal-container .OnePersonmsg {
  display: flex;
  padding: 8px 16px 12px;
  border-bottom: 1px solid #f0f0f0;
  gap: 10px;
}
.modal-container .OnePersonmsg:last-child { border-bottom: none; }
.modal-container .OnePersonmsg .left { flex-shrink: 0; }
.modal-container .OnePersonmsg .left .avatar img {
  width: 36px; height: 36px;
  border-radius: 4px;
  object-fit: cover;
}
.modal-container .left .avatar-placeholder {
  width: 36px; height: 36px;
  border-radius: 4px;
  font-size: 15px;
}
.modal-container .OnePersonmsg .right { flex: 1; min-width: 0; }
.modal-container .msg-block { width: 100%; }
.modal-container .msg-container-top {
  font-size: 12px;
  color: #888;
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.modal-container .msg-container {
  font-size: 13px;
  line-height: 1.6;
  color: #1a1a1a;
  word-break: break-word;
  white-space: pre-wrap;
}
.modal-container .msg-container img,
.modal-container .msg-container video {
  max-width: 240px;
  max-height: 200px;
  border-radius: 4px;
  display: block;
}

/* 鈹€鈹€ Image Preview Modal 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.modal {
  display: none;
  position: fixed;
  z-index: 9999;
  inset: 0;
  background: rgba(0,0,0,.85);
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}
.modal.open { display: flex; }
.modal-image {
  max-width: 92vw;
  max-height: 92vh;
  border-radius: 6px;
  object-fit: contain;
  box-shadow: 0 8px 40px rgba(0,0,0,.6);
  transition: transform .1s ease;
  cursor: default;
}

/* 鈹€鈹€ Highlight (time-jump) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.item.highlight .bubble,
.item.highlight .bubble-left,
.item.highlight .bubble-right,
.item.highlight .chat-image,
.item.highlight .merge-message {
  outline: 2px solid #07c160;
  outline-offset: 3px;
  border-radius: 5px;
}

/* 鈹€鈹€ Loader 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
.loader {
  position: fixed; inset: 0;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  font-size: 14px;
  color: #888;
}
.loader::after {
  content: "鍔犺浇涓€?;
}

/* 鈹€鈹€ Responsive 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ */
@media (max-width: 768px) {
  .page { flex-direction: column; border-radius: 0; }
  .mid-bar { display: none; }
  .content { padding: 8px 10px; }
  .content-wrapper { max-width: 80%; }
  .chat-image img { max-width: 200px; max-height: 200px; }
  .card { max-width: 220px; width: 220px; }
  .merge-msg-modal-content { width: 95vw; }
}
`;
