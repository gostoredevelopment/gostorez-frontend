import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { supabase } from '../../lib/supabaseClient';
import imageCompression from 'browser-image-compression';
import {
  Video, Mic, MicOff, VideoOff, Phone, PhoneOff, Send, Image as ImageIcon,
  X, Trash2, Edit2, Save, Heart, MessageCircle, MoreVertical, ChevronDown,
  ChevronUp, Clock, AlertCircle, RefreshCw, User as UserIcon, Store, MapPin,
  Calendar, CheckCircle, ArrowLeft, Users, Maximize2, Minimize2, Move,
  ChevronLeft, ChevronRight, Expand, Shrink
} from 'lucide-react';
import './OpenMarket.css';

// Types
interface OpenMarketSettings {
  id: number;
  active_status: boolean;
  open_date: string | null;
  close_date: string | null;
  schedule_type: 'once' | 'regular';
}

interface VideoRoom {
  id: string;
  room_name: string;
  created_by_user_id: string;
  created_by_name: string;
  created_by_avatar?: string;
  participant_count: number;
  is_active: boolean;
  created_at: string;
  last_activity: string;
}

interface VendorShop {
  id: string;
  vendor_id: string;
  shop_name: string;
  profile_image: string;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  text: string;
  created_at: string;
}

interface Post {
  id: string;
  user_id: string;
  text: string;
  media_urls: string[] | null;
  media_types: string[] | null;
  created_at: string;
  expires_at: string;
  updated_at: string;
  user_name?: string;
  user_avatar?: string;
  vendor_shops?: VendorShop[];
  comments?: Comment[];
  comments_count?: number;
  likes_count?: number;
  is_liked_by_user?: boolean;
  live_room_id?: string | null;
}

// Helper functions
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const compressImage = async (file: File): Promise<File> => {
  const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
  return await imageCompression(file, options);
};

const OpenMarket: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userName, setUserName] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [userShops, setUserShops] = useState<VendorShop[]>([]);
  const [settings, setSettings] = useState<OpenMarketSettings | null>(null);
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [videoRooms, setVideoRooms] = useState<VideoRoom[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostMedia, setNewPostMedia] = useState<{ file: File; preview: string; type: 'image' | 'video' }[]>([]);
  const [uploadingPost, setUploadingPost] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showCommentsFor, setShowCommentsFor] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [userPostCount, setUserPostCount] = useState(0);
  const [showPostForm, setShowPostForm] = useState(false);
  const [activeLiveRoom, setActiveLiveRoom] = useState<VideoRoom | null>(null);
  const [liveVideoMinimized, setLiveVideoMinimized] = useState(false);
  const [liveVideoSize, setLiveVideoSize] = useState({ width: 320, height: 240 });
  const [liveVideoPosition, setLiveVideoPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState<string | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [selectedPostMedia, setSelectedPostMedia] = useState<{ urls: string[]; types: string[]; index: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; initialWidth: number; initialHeight: number } | null>(null);
  const liveVideoRef = useRef<HTMLDivElement>(null);
  const MAX_POSTS_PER_USER = 10;
  const POST_TEXT_LIMIT = 1000;
  const MAX_IMAGES = 4;

  // Fetch current user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        let name = user.displayName || user.email?.split('@')[0] || 'User';
        let avatar = '';
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('name, avatar_url')
            .eq('firebase_uid', user.uid)
            .single();
          if (userData?.name) name = userData.name;
          if (userData?.avatar_url) avatar = userData.avatar_url;
        } catch (e) {}
        setUserName(name);
        setUserAvatar(avatar);
        console.log('✅ [OpenMarket] User loaded:', { name, avatar });

        const { data: shops } = await supabase
          .from('vendor_profiles')
          .select('id, vendor_id, shop_name, profile_image')
          .eq('user_id', user.uid);
        setUserShops(shops || []);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load data when user ready
  useEffect(() => {
    if (!currentUser) return;
    console.log('🔄 [OpenMarket] Loading initial data...');
    loadSettings();
    loadVideoRooms();
    loadPosts();
    const interval = setInterval(() => {
      loadVideoRooms();
      loadPosts();
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Auto-cleanup inactive video rooms every minute
  useEffect(() => {
    const cleanup = setInterval(async () => {
      const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('openmarket_video_rooms')
        .update({ is_active: false })
        .lt('last_activity', twoMinsAgo)
        .eq('is_active', true);
      if (!error) loadVideoRooms();
    }, 60000);
    return () => clearInterval(cleanup);
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase.from('openmarket_settings').select('*').single();
      if (error) throw error;
      setSettings(data);
      checkMarketOpen(data);
      console.log('✅ [OpenMarket] Settings loaded:', data);
    } catch (err) { console.error('❌ [OpenMarket] Error loading settings:', err); }
  };

  const checkMarketOpen = (settings: OpenMarketSettings) => {
    if (!settings.active_status) {
      setIsMarketOpen(false);
      setScheduleMessage('Market closed');
      return;
    }
    const now = new Date();
    if (settings.open_date && settings.close_date) {
      const open = new Date(settings.open_date);
      const close = new Date(settings.close_date);
      if (now >= open && now <= close) {
        setIsMarketOpen(true);
        setScheduleMessage(`Open until ${close.toLocaleTimeString()}`);
      } else {
        setIsMarketOpen(false);
        setScheduleMessage(now < open ? `Opens ${open.toLocaleDateString()}` : 'Market closed');
      }
    } else {
      setIsMarketOpen(true);
      setScheduleMessage('Open now');
    }
  };

  const loadVideoRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('openmarket_video_rooms')
        .select('*')
        .eq('is_active', true)
        .order('participant_count', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      console.log('✅ [OpenMarket] Video rooms loaded:', data?.length || 0);
      
      const userIds: string[] = [];
      if (data) {
        data.forEach(r => {
          if (!userIds.includes(r.created_by_user_id)) userIds.push(r.created_by_user_id);
        });
      }
      let avatars: Record<string, string> = {};
      if (userIds.length) {
        const { data: users } = await supabase
          .from('users')
          .select('firebase_uid, avatar_url')
          .in('firebase_uid', userIds);
        if (users) users.forEach(u => { avatars[u.firebase_uid] = u.avatar_url || ''; });
      }
      const rooms = (data || []).map(r => ({ ...r, created_by_avatar: avatars[r.created_by_user_id] }));
      setVideoRooms(rooms);
    } catch (err) { console.error('❌ [OpenMarket] Error loading video rooms:', err); }
  };

  const generateUniqueRoomName = async (baseName: string): Promise<string> => {
    let roomName = baseName;
    let counter = 0;
    while (true) {
      const { data } = await supabase
        .from('openmarket_video_rooms')
        .select('id')
        .eq('room_name', roomName)
        .maybeSingle();
      if (!data) return roomName;
      counter++;
      roomName = `${baseName}${counter}`;
    }
  };

  const createLivePost = async (roomId: string, roomName: string) => {
    if (userPostCount >= MAX_POSTS_PER_USER) return;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('openmarket_posts').insert({
      user_id: currentUser.uid,
      text: `🔴 Went live: ${roomName}`,
      media_urls: null,
      media_types: null,
      live_room_id: roomId,
      created_at: new Date().toISOString(),
      expires_at: expiresAt
    });
    await loadPosts();
  };

  const handleGoLive = async () => {
    if (!currentUser || creatingRoom) return;
    setCreatingRoom(true);
    console.log('🎥 [OpenMarket] Starting live video...');
    try {
      const firstName = userName.split(' ')[0] || 'User';
      const roomName = await generateUniqueRoomName(firstName);
      const { data, error } = await supabase
        .from('openmarket_video_rooms')
        .insert({
          room_name: roomName,
          created_by_user_id: currentUser.uid,
          created_by_name: userName,
          participant_count: 1,
          is_active: true,
          last_activity: new Date().toISOString()
        })
        .select()
        .single();
      if (error) throw error;
      await createLivePost(data.id, roomName);
      setActiveLiveRoom({ ...data, created_by_avatar: userAvatar });
      setLiveVideoMinimized(false);
      setLiveVideoSize({ width: 320, height: 240 });
      console.log('✅ [OpenMarket] Live started, room:', roomName);
    } catch (err) {
      console.error('❌ [OpenMarket] Failed to start live:', err);
      alert('Failed to start live video');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleJoinRoom = async (room: VideoRoom) => {
    console.log('🎥 [OpenMarket] Joining room:', room.room_name);
    await supabase
      .from('openmarket_video_rooms')
      .update({ participant_count: room.participant_count + 1, last_activity: new Date().toISOString() })
      .eq('id', room.id);
    setActiveLiveRoom(room);
    setLiveVideoMinimized(false);
    setLiveVideoSize({ width: 320, height: 240 });
  };

  const handleEndLive = async () => {
    if (activeLiveRoom) {
      console.log('🔴 [OpenMarket] Ending live:', activeLiveRoom.room_name);
      await supabase
        .from('openmarket_video_rooms')
        .update({ is_active: false })
        .eq('id', activeLiveRoom.id);
      await supabase
        .from('openmarket_posts')
        .delete()
        .eq('live_room_id', activeLiveRoom.id);
      setActiveLiveRoom(null);
      await loadVideoRooms();
      await loadPosts();
    }
  };

  // Drag and resize handlers for floating video
  const handleDragStart = (e: React.MouseEvent) => {
    if (!liveVideoRef.current) return;
    e.preventDefault();
    setIsDragging(true);
    const rect = liveVideoRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: rect.left,
      initialY: rect.top
    };
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setLiveVideoPosition({
      x: Math.max(0, Math.min(window.innerWidth - liveVideoSize.width, dragRef.current.initialX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - liveVideoSize.height, dragRef.current.initialY + dy))
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    dragRef.current = null;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialWidth: liveVideoSize.width,
      initialHeight: liveVideoSize.height
    };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizeRef.current) return;
    const dx = e.clientX - resizeRef.current.startX;
    const dy = e.clientY - resizeRef.current.startY;
    const newWidth = Math.max(240, Math.min(window.innerWidth - 40, resizeRef.current.initialWidth + dx));
    const newHeight = Math.max(180, Math.min(window.innerHeight - 100, resizeRef.current.initialHeight + dy));
    setLiveVideoSize({ width: newWidth, height: newHeight });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    resizeRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  const loadPosts = async () => {
    try {
      console.log('📝 [OpenMarket] Loading posts...');
      const { data: postsData, error } = await supabase
        .from('openmarket_posts')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      console.log('✅ [OpenMarket] Posts loaded:', postsData?.length || 0);
      if (postsData && postsData.length > 0) {
        console.log('📸 [OpenMarket] Sample post media:', postsData[0].media_urls);
      }

      const userIds: string[] = [];
      if (postsData) {
        postsData.forEach(p => {
          if (!userIds.includes(p.user_id)) userIds.push(p.user_id);
        });
      }
      
      let userProfiles: Record<string, { name: string; avatar: string }> = {};
      if (userIds.length) {
        const { data: users } = await supabase
          .from('users')
          .select('firebase_uid, name, avatar_url')
          .in('firebase_uid', userIds);
        if (users) users.forEach(u => { userProfiles[u.firebase_uid] = { name: u.name || 'User', avatar: u.avatar_url || '' }; });
      }

      let userShopsMap: Record<string, VendorShop[]> = {};
      if (userIds.length) {
        const { data: shops } = await supabase
          .from('vendor_profiles')
          .select('user_id, id, vendor_id, shop_name, profile_image')
          .in('user_id', userIds);
        if (shops) shops.forEach(shop => {
          if (!userShopsMap[shop.user_id]) userShopsMap[shop.user_id] = [];
          userShopsMap[shop.user_id].push({
            id: shop.id,
            vendor_id: shop.vendor_id,
            shop_name: shop.shop_name,
            profile_image: shop.profile_image || ''
          });
        });
      }

      const postIds: string[] = [];
      if (postsData) {
        postsData.forEach(p => {
          if (!postIds.includes(p.id)) postIds.push(p.id);
        });
      }
      
      let commentsCount: Record<string, number> = {};
      if (postIds.length) {
        const { data: counts } = await supabase
          .from('openmarket_comments')
          .select('post_id')
          .in('post_id', postIds);
        if (counts) counts.forEach(c => { commentsCount[c.post_id] = (commentsCount[c.post_id] || 0) + 1; });
      }

      let likesCount: Record<string, number> = {};
      let userLikes: string[] = [];
      if (postIds.length && currentUser) {
        const { data: likes } = await supabase
          .from('openmarket_post_likes')
          .select('post_id, user_id')
          .in('post_id', postIds);
        if (likes) {
          likes.forEach(l => {
            likesCount[l.post_id] = (likesCount[l.post_id] || 0) + 1;
            if (l.user_id === currentUser.uid) userLikes.push(l.post_id);
          });
        }
      }

      const enriched: Post[] = (postsData || []).map(post => ({
        ...post,
        media_urls: post.media_urls || null,
        media_types: post.media_types || null,
        user_name: userProfiles[post.user_id]?.name || 'User',
        user_avatar: userProfiles[post.user_id]?.avatar,
        vendor_shops: userShopsMap[post.user_id] || [],
        comments_count: commentsCount[post.id] || 0,
        likes_count: likesCount[post.id] || 0,
        is_liked_by_user: userLikes.includes(post.id)
      }));
      setPosts(enriched);

      if (currentUser) {
        const { count } = await supabase
          .from('openmarket_posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUser.uid)
          .gt('expires_at', new Date().toISOString());
        setUserPostCount(count || 0);
      }
    } catch (err) { console.error('❌ [OpenMarket] Error loading posts:', err); }
  };

  const handleLikePost = async (postId: string) => {
    if (!currentUser) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (post.is_liked_by_user) {
      await supabase
        .from('openmarket_post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', currentUser.uid);
    } else {
      await supabase
        .from('openmarket_post_likes')
        .insert({ post_id: postId, user_id: currentUser.uid });
    }
    await loadPosts();
  };

  const handlePostSubmit = async () => {
    if (!currentUser) return;
    if (!newPostText.trim() && newPostMedia.length === 0) {
      alert('Please enter text or attach media');
      return;
    }
    if (newPostText.length > POST_TEXT_LIMIT) {
      alert(`Text cannot exceed ${POST_TEXT_LIMIT} characters`);
      return;
    }
    if (userPostCount >= MAX_POSTS_PER_USER) {
      alert(`You can only have up to ${MAX_POSTS_PER_USER} active posts.`);
      return;
    }
    setUploadingPost(true);
    console.log('📝 [OpenMarket] Submitting post with', newPostMedia.length, 'media items');
    try {
      const mediaUrls: string[] = [];
      const mediaTypes: string[] = [];
      for (const item of newPostMedia) {
        let file = item.file;
        if (item.type === 'image') file = await compressImage(file);
        const base64 = await fileToBase64(file);
        mediaUrls.push(base64);
        mediaTypes.push(item.type);
        console.log('📸 [OpenMarket] Media converted, type:', item.type, 'length:', base64.length);
      }
      const { error } = await supabase.from('openmarket_posts').insert({
        user_id: currentUser.uid,
        text: newPostText.trim() || null,
        media_urls: mediaUrls.length ? mediaUrls : null,
        media_types: mediaTypes.length ? mediaTypes : null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
      if (error) throw error;
      console.log('✅ [OpenMarket] Post submitted successfully');
      setNewPostText('');
      setNewPostMedia([]);
      setShowPostForm(false);
      await loadPosts();
    } catch (err) {
      console.error('❌ [OpenMarket] Failed to post:', err);
      alert('Failed to post');
    } finally {
      setUploadingPost(false);
    }
  };

  const handleEditPost = async (postId: string, newText: string) => {
    if (!newText.trim()) return;
    const { error } = await supabase
      .from('openmarket_posts')
      .update({ text: newText.trim(), updated_at: new Date().toISOString() })
      .eq('id', postId)
      .eq('user_id', currentUser?.uid);
    if (error) alert('Failed to edit');
    else { setEditingPostId(null); setEditingText(''); await loadPosts(); }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Delete this post?')) return;
    setDeletingPostId(postId);
    const { error } = await supabase
      .from('openmarket_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', currentUser?.uid);
    if (error) alert('Failed to delete');
    else await loadPosts();
    setDeletingPostId(null);
  };

  const loadCommentsForPost = async (postId: string): Promise<Comment[]> => {
    const { data, error } = await supabase
      .from('openmarket_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) return [];
    const userIds: string[] = [];
    if (data) {
      data.forEach(c => {
        if (!userIds.includes(c.user_id)) userIds.push(c.user_id);
      });
    }
    let avatars: Record<string, string> = {};
    if (userIds.length) {
      const { data: users } = await supabase
        .from('users')
        .select('firebase_uid, avatar_url')
        .in('firebase_uid', userIds);
      if (users) users.forEach(u => { avatars[u.firebase_uid] = u.avatar_url || ''; });
    }
    return (data || []).map(c => ({ ...c, user_avatar: avatars[c.user_id] }));
  };

  const handleToggleComments = async (postId: string) => {
    if (showCommentsFor === postId) {
      setShowCommentsFor(null);
    } else {
      const comments = await loadCommentsForPost(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments } : p));
      setShowCommentsFor(postId);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!currentUser || !commentInput.trim()) return;
    setSubmittingComment(true);
    try {
      await supabase.from('openmarket_comments').insert({
        post_id: postId,
        user_id: currentUser.uid,
        user_name: userName,
        text: commentInput.trim()
      });
      setCommentInput('');
      const comments = await loadCommentsForPost(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments, comments_count: comments.length } : p));
    } catch (err) { alert('Failed to comment'); }
    finally { setSubmittingComment(false); }
  };

  const handleShopClick = (shops: VendorShop[]) => {
    if (!shops.length) return;
    if (shops.length === 1) navigate(`/vendor/${shops[0].vendor_id}`);
    else {
      const choice = prompt(`Choose shop:\n${shops.map((s, i) => `${i+1}. ${s.shop_name}`).join('\n')}\nEnter number:`);
      const idx = parseInt(choice || '') - 1;
      if (idx >= 0 && idx < shops.length) navigate(`/vendor/${shops[idx].vendor_id}`);
    }
  };

  const handleOpenMediaFullscreen = (urls: string[], types: string[], index: number) => {
    console.log('🖼️ [OpenMarket] Opening fullscreen media:', index);
    setSelectedPostMedia({ urls, types, index });
    setFullscreenMedia(urls[index]);
    setCurrentMediaIndex(index);
  };

  const nextMedia = () => {
    if (selectedPostMedia && selectedPostMedia.index < selectedPostMedia.urls.length - 1) {
      const newIndex = selectedPostMedia.index + 1;
      setSelectedPostMedia({ ...selectedPostMedia, index: newIndex });
      setFullscreenMedia(selectedPostMedia.urls[newIndex]);
      setCurrentMediaIndex(newIndex);
    }
  };

  const prevMedia = () => {
    if (selectedPostMedia && selectedPostMedia.index > 0) {
      const newIndex = selectedPostMedia.index - 1;
      setSelectedPostMedia({ ...selectedPostMedia, index: newIndex });
      setFullscreenMedia(selectedPostMedia.urls[newIndex]);
      setCurrentMediaIndex(newIndex);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) return <div className="openmarket-loading"><div className="openmarket-spinner"></div></div>;

  return (
    <div className="openmarket-container">
      {/* Header with status badge at right - full text always visible */}
      <header className="openmarket-header">
        <button className="openmarket-back" onClick={() => navigate(-1)}><ArrowLeft size={16} /></button>
        <h1 className="openmarket-title">
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
    <Video size={18} />
    <span>Community</span>
  </span>
</h1>
        <div className={`market-status-badge ${isMarketOpen ? 'open' : 'closed'}`}>
          <span className="status-icon-small">
            {isMarketOpen ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
          </span>
          <span className="status-text-full">{isMarketOpen ? 'Open' : 'Closed'}</span>
          {scheduleMessage && <span className="status-schedule-full">{scheduleMessage}</span>}
        </div>
      </header>

      {!isMarketOpen ? (
        <div className="openmarket-closed-message">
          <AlertCircle size={48} /><h3>Market is closed</h3><p>{scheduleMessage}</p>
        </div>
      ) : (
        <>
          {/* Section: Action Buttons - Post and Go Live (reduced size) */}
          <div className="openmarket-section compact">
            <div className="action-buttons-scroll">
              {/* Post button - shows post creation form */}
              <button 
                className="action-btn post-btn" 
                onClick={() => setShowPostForm(!showPostForm)}
              >
                <Send size={18} />
                <span>Post</span>
              </button>
              {/* Go Live button */}
              <button className="action-btn live-btn" onClick={handleGoLive} disabled={creatingRoom}>
                <Video size={18} />
                <span>{creatingRoom ? 'Starting...' : 'Go Live'}</span>
              </button>
              {/* Active video rooms */}
              {videoRooms.map(room => (
                <button key={room.id} className="action-btn room-btn" onClick={() => handleJoinRoom(room)}>
                  <div className="room-avatar-small">
                    {room.created_by_avatar ? <img src={room.created_by_avatar} alt="" /> : room.created_by_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="room-name-small">{room.room_name}</span>
                  <span className="room-count"><Users size={10} /> {room.participant_count}</span>
                </button>
              ))}
              {videoRooms.length === 0 && !creatingRoom && (
                <div className="no-rooms-hint">No active rooms</div>
              )}
            </div>
          </div>

          {/* Post Creation Form - appears when Post button is clicked */}
          {showPostForm && (
            <div className="openmarket-section post-form-section">
              <div className="post-create-card">
                <textarea className="post-input" placeholder="What's on your mind? (max 1000 chars)"
                  value={newPostText} onChange={e => setNewPostText(e.target.value.slice(0, POST_TEXT_LIMIT))} rows={2} />
                {newPostMedia.length > 0 && (
                  <div className="media-preview-grid">
                    {newPostMedia.map((m, idx) => (
                      <div key={idx} className="media-preview-item">
                        {m.type === 'image' ? <img src={m.preview} alt="" /> : <video src={m.preview} />}
                        <button onClick={() => setNewPostMedia(prev => prev.filter((_, i) => i !== idx))}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="post-actions">
                  <label className="attach-media-btn">
                    <ImageIcon size={18} />
                    <input type="file" accept="image/*,video/*" multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (newPostMedia.length + files.length > MAX_IMAGES) {
                          alert(`Max ${MAX_IMAGES} images allowed`);
                          return;
                        }
                        for (const file of files) {
                          if (file.size > 2 * 1024 * 1024) { alert('File too large (>2MB)'); continue; }
                          const type = file.type.startsWith('image/') ? 'image' : 'video';
                          const preview = URL.createObjectURL(file);
                          setNewPostMedia(prev => [...prev, { file, preview, type }]);
                        }
                        e.target.value = '';
                      }}
                      style={{ display: 'none' }} />
                  </label>
                  <span className="post-limit">({userPostCount}/{MAX_POSTS_PER_USER})</span>
                  <button className="submit-post-btn" onClick={handlePostSubmit} disabled={uploadingPost || (!newPostText.trim() && !newPostMedia.length)}>
                    {uploadingPost ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section: Community Posts */}
          <div className="openmarket-section">
            <div className="posts-feed">
              {posts.length === 0 ? <div className="no-posts">No posts yet</div> : posts.map(post => {
                const isOwner = currentUser?.uid === post.user_id;
                const isEditing = editingPostId === post.id;
                const hasMedia = post.media_urls && post.media_urls.length > 0;
                return (
                  <div key={post.id} className="post-card">
                    <div className="post-header">
                      <div className="post-user">
                        {post.user_avatar ? <img src={post.user_avatar} className="post-avatar" alt="" /> :
                          <div className="post-avatar-placeholder">{post.user_name?.charAt(0) || 'U'}</div>}
                        <div className="post-user-info">
                          <span className="post-user-name">{post.user_name}</span>
                          <div className="post-time">{formatTimeAgo(post.created_at)}</div>
                        </div>
                      </div>
                      {isOwner && (
                        <div className="post-actions-dropdown">
                          <button className="post-more-btn" onClick={() => { setEditingText(post.text); setEditingPostId(post.id); }}><Edit2 size={14} /></button>
                          <button className="post-delete-btn" onClick={() => handleDeletePost(post.id)} disabled={deletingPostId === post.id}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="post-edit-area">
                        <textarea value={editingText} onChange={e => setEditingText(e.target.value.slice(0, POST_TEXT_LIMIT))} rows={3} />
                        <div className="edit-actions">
                          <button onClick={() => handleEditPost(post.id, editingText)}>Save</button>
                          <button onClick={() => { setEditingPostId(null); setEditingText(''); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="post-text">{post.text}</div>
                        {/* Images/Media displayed below text */}
                        {hasMedia && (
                          <div className="post-media-slider">
                            <div className="media-slider-container">
                              {post.media_urls!.map((url, idx) => (
                                <div key={idx} className="media-slide" onClick={() => handleOpenMediaFullscreen(post.media_urls!, post.media_types!, idx)}>
                                  {post.media_types?.[idx] === 'image' ? (
                                    <img src={url} alt="" onError={(e) => console.error('❌ Image failed to load:', url)} />
                                  ) : (
                                    <video src={url} onError={(e) => console.error('❌ Video failed to load:', url)} />
                                  )}
                                </div>
                              ))}
                            </div>
                            {post.media_urls!.length > 1 && (
                              <div className="media-slider-dots">
                                {post.media_urls!.map((_, idx) => (
                                  <span key={idx} className="dot" />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {/* Vendor shops displayed after media */}
                        {post.vendor_shops && post.vendor_shops.length > 0 && (
                          <div className="post-vendor-shops">
                            <Store size={12} /><span>Shop{post.vendor_shops.length > 1 ? 's' : ''}: </span>
                            {post.vendor_shops.map((shop, idx) => (
                              <button key={shop.id} className="vendor-shop-link" onClick={() => handleShopClick(post.vendor_shops!)}>
                                {shop.shop_name}{idx < (post.vendor_shops?.length || 0) - 1 ? ', ' : ''}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    <div className="post-stats">
                      <button className={`like-btn ${post.is_liked_by_user ? 'liked' : ''}`} onClick={() => handleLikePost(post.id)}>
                        <Heart size={14} /> <span>{post.likes_count || 0}</span>
                      </button>
                      <button className="comment-toggle-btn" onClick={() => handleToggleComments(post.id)}>
                        <MessageCircle size={14} /> <span>{post.comments_count || 0}</span>
                      </button>
                      {post.live_room_id && (
                        <button className="live-badge" onClick={() => {
                          const liveRoom = videoRooms.find(r => r.id === post.live_room_id);
                          if (liveRoom) handleJoinRoom(liveRoom);
                        }}>🔴 Live</button>
                      )}
                    </div>
                    {showCommentsFor === post.id && (
                      <div className="comments-list">
                        {post.comments?.map(c => (
                          <div key={c.id} className="comment-item">
                            <div className="comment-user">
                              {c.user_avatar ? <img src={c.user_avatar} alt="" /> : <span>{c.user_name.charAt(0)}</span>}
                              <strong>{c.user_name}</strong>
                            </div>
                            <div className="comment-text">{c.text}</div>
                            <div className="comment-time">{formatTimeAgo(c.created_at)}</div>
                          </div>
                        ))}
                        <div className="comment-input-wrapper">
                          <input type="text" placeholder="Write a comment..." value={commentInput} onChange={e => setCommentInput(e.target.value)} />
                          <button onClick={() => handleAddComment(post.id)} disabled={submittingComment || !commentInput.trim()}><Send size={14} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Fullscreen media modal with navigation */}
      {fullscreenMedia && selectedPostMedia && (
        <div className="fullscreen-media" onClick={() => setFullscreenMedia(null)}>
          <button className="fullscreen-close" onClick={() => setFullscreenMedia(null)}><X size={24} /></button>
          {selectedPostMedia.urls.length > 1 && (
            <>
              <button className="fullscreen-prev" onClick={(e) => { e.stopPropagation(); prevMedia(); }}><ChevronLeft size={32} /></button>
              <button className="fullscreen-next" onClick={(e) => { e.stopPropagation(); nextMedia(); }}><ChevronRight size={32} /></button>
            </>
          )}
          {selectedPostMedia.types[selectedPostMedia.index] === 'image' ? (
            <img src={fullscreenMedia} alt="Fullscreen" onClick={(e) => e.stopPropagation()} />
          ) : (
            <video src={fullscreenMedia} controls autoPlay onClick={(e) => e.stopPropagation()} />
          )}
          <div className="fullscreen-counter">{selectedPostMedia.index + 1} / {selectedPostMedia.urls.length}</div>
        </div>
      )}

      {/* Floating Live Video Window with resize and close */}
      {activeLiveRoom && (
        <div
          ref={liveVideoRef}
          className={`floating-video ${liveVideoMinimized ? 'minimized' : ''}`}
          style={{
            left: liveVideoPosition.x,
            top: liveVideoPosition.y,
            width: liveVideoSize.width,
            height: liveVideoMinimized ? 50 : liveVideoSize.height
          }}
        >
          <div className="floating-video-header" onMouseDown={handleDragStart}>
            <div className="drag-handle"><Move size={14} /></div>
            <span>{activeLiveRoom.room_name}</span>
            <div className="video-controls">
              <button onClick={() => setLiveVideoMinimized(!liveVideoMinimized)}>
                {liveVideoMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
              <button onClick={() => {
                const newSize = { width: Math.min(window.innerWidth - 40, liveVideoSize.width + 50), height: Math.min(window.innerHeight - 100, liveVideoSize.height + 50) };
                setLiveVideoSize(newSize);
              }}><Expand size={14} /></button>
              <button onClick={() => {
                const newSize = { width: Math.max(240, liveVideoSize.width - 50), height: Math.max(180, liveVideoSize.height - 50) };
                setLiveVideoSize(newSize);
              }}><Shrink size={14} /></button>
              {currentUser?.uid === activeLiveRoom.created_by_user_id && (
                <button onClick={handleEndLive}><PhoneOff size={14} /></button>
              )}
              <button onClick={() => {
                if (currentUser?.uid !== activeLiveRoom.created_by_user_id) {
                  setActiveLiveRoom(null);
                }
              }}><X size={14} /></button>
            </div>
          </div>
          {!liveVideoMinimized && (
            <>
              <iframe
                src={`https://p2p.mirotalk.com/join?room=${activeLiveRoom.room_name}`}
                allow="camera; microphone; display-capture; fullscreen; autoplay"
                className="floating-video-iframe"
                title="Live Video"
              />
              <div className="resize-handle" onMouseDown={handleResizeStart}></div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default OpenMarket;