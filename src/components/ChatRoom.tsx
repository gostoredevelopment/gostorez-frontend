import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon,
  Mic, 
  Check,
  CheckCheck,
  User,
  Store,
  Phone,
  Video,
  Info,
  X,
  AlertCircle,
  Shield,
  Search,
  Paperclip,
  Smile,
  Download,
  FileText,
  Play,
  Pause,
  XCircle,
  Trash2,
  Copy,
  Reply,
  Share2,
  Star,
  Pin,
  Camera,
  Music,
  BarChart,
  MapPin,
  Bell,
  Archive
} from "lucide-react";
import "./ChatRoom.css";

type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  sender_type?: 'user' | 'vendor';
  message_type: 'text' | 'image' | 'voice' | 'document' | 'emoji';
  message_text: string;
  media_url?: string;
  media_type?: string;
  file_name?: string;
  file_size?: number;
  duration?: number;
  thumbnail_url?: string;
  caption?: string;
  is_read: boolean;
  read_at?: string;
  delivered: boolean;
  delivered_at?: string;
  starred_by?: string[];
  pinned: boolean;
  pinned_at?: string;
  pinned_by?: string;
  deleted_for?: string[];
  reply_to_message_id?: string;
  reply_to_message_text?: string;
  reply_to_message_sender?: string;
  reactions?: MessageReaction[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
};

type MessageReaction = {
  id: string;
  emoji_code: string;
  emoji_name: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  created_at: string;
};

type Participant = {
  id: string;
  name: string;
  avatar_url?: string;
  user_type: 'user' | 'vendor';
  firebase_uid?: string;
  shop_id?: string;
  shop_name?: string;
  shop_avatar?: string;
  is_online?: boolean;
  last_seen?: string;
  typing?: boolean;
};

type RoomDetails = {
  id: string;
  p_a: string;
  p_b: string;
  p_a_name: string;
  p_b_name: string;
  p_a_image?: string;
  p_b_image?: string;
  chat_type: 'user_user' | 'user_vendor' | 'vendor_vendor';
  product_id?: string;
  product_name?: string;
  product_image?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
};

type Emoji = {
  id: string;
  code: string;
  name: string;
  category: string;
  url: string;
};

type RecordingState = {
  isRecording: boolean;
  time: number;
  blob: Blob | null;
  audioChunks: BlobPart[];
  mediaRecorder: MediaRecorder | null;
  stream: MediaStream | null;
};

type UploadProgress = {
  fileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploaded: number;
  total: number;
  percentage: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
};

type TypingIndicator = {
  user_id: string;
  typing: boolean;
  updated_at: string;
};

export default function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  const [user, setUser] = useState<any>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string>('');
  const [supabaseUserData, setSupabaseUserData] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<Participant | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [recording, setRecording] = useState<RecordingState>({
    isRecording: false,
    time: 0,
    blob: null,
    audioChunks: [],
    mediaRecorder: null,
    stream: null
  });
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Record<string, HTMLAudioElement>>({});
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Get Supabase user ID from Firebase UID
  const getSupabaseUserId = async (firebaseUid: string): Promise<{id: string, data: any}> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('firebase_uid', firebaseUid)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('User not found in Supabase');
      return { id: data.id, data };
    } catch (error) {
      console.error('Error getting Supabase user ID:', error);
      throw error;
    }
  };

  // Fetch emojis from database
  const fetchEmojis = async () => {
    try {
      const { data, error } = await supabase
        .from('emojis')
        .select('*')
        .order('category')
        .order('name')
        .limit(50);

      if (error) throw error;
      setEmojis(data || []);
    } catch (error) {
      console.error('Error fetching emojis:', error);
    }
  };

  // Fetch room details and identify participants
  const fetchRoomDetails = useCallback(async (userId: string, userData: any) => {
    if (!roomId) return;

    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();

      if (roomError) throw roomError;
      if (!roomData) {
        setError('Chat room not found');
        return;
      }

      setRoomDetails(roomData);

      // Identify current user's details
      const isParticipantA = roomData.p_a === userId;
      const otherParticipantId = isParticipantA ? roomData.p_b : roomData.p_a;

      // Set current participant from user data
      setCurrentParticipant({
        id: userId,
        name: userData.name || 'User',
        avatar_url: userData.avatar_url,
        user_type: userData.user_type || 'user',
        firebase_uid: userData.firebase_uid,
        is_online: userData.is_active,
        last_seen: userData.last_seen,
        typing: false
      });

      // Get other participant details
      const { data: otherUserData } = await supabase
        .from('users')
        .select('*')
        .eq('id', otherParticipantId)
        .maybeSingle();

      let otherParticipantInfo: Participant = {
        id: otherParticipantId,
        name: isParticipantA ? roomData.p_b_name : roomData.p_a_name,
        avatar_url: isParticipantA ? roomData.p_b_image : roomData.p_a_image,
        user_type: 'user',
        is_online: false,
        last_seen: new Date().toISOString(),
        typing: false
      };

      if (otherUserData) {
        otherParticipantInfo = {
          ...otherParticipantInfo,
          name: otherUserData.name || otherParticipantInfo.name,
          avatar_url: otherUserData.avatar_url || otherParticipantInfo.avatar_url,
          user_type: otherUserData.user_type || 'user',
          firebase_uid: otherUserData.firebase_uid,
          is_online: otherUserData.is_active,
          last_seen: otherUserData.last_seen
        };
      }

      // If it's a vendor, get shop details
      if (otherParticipantInfo.user_type === 'vendor' && otherParticipantInfo.firebase_uid) {
        const { data: shopData } = await supabase
          .from('vendor_profiles')
          .select('shop_name, profile_image')
          .eq('user_id', otherParticipantInfo.firebase_uid)
          .maybeSingle();

        if (shopData) {
          otherParticipantInfo.shop_name = shopData.shop_name;
          otherParticipantInfo.shop_avatar = shopData.profile_image || otherParticipantInfo.avatar_url;
        }
      }

      setOtherParticipant(otherParticipantInfo);

    } catch (error: any) {
      console.error('❌ Error fetching room details:', error);
      setError('Failed to load chat details: ' + (error.message || 'Unknown error'));
    }
  }, [roomId]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!roomId || !supabaseUserId) return;

    setLoading(true);
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .not('deleted_for', 'cs', `{"${supabaseUserId}"}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messagesWithDetails = await Promise.all(
        (messagesData || []).map(async (msg) => {
          let senderName = msg.sender_name;
          let senderAvatar = msg.sender_avatar;

          if (!senderName || !senderAvatar) {
            const { data: senderData } = await supabase
              .from('users')
              .select('name, avatar_url, user_type')
              .eq('id', msg.sender_id)
              .maybeSingle();

            if (senderData) {
              senderName = senderData.name;
              senderAvatar = senderData.avatar_url;
            }
          }

          // Fetch reactions with proper typing
          const { data: reactionsData } = await supabase
            .from('message_reactions')
            .select(`
              id,
              emoji_code,
              emoji_name,
              user_id,
              users!inner(name, avatar_url)
            `)
            .eq('message_id', msg.id);

          // Handle the nested users array properly
          const reactions = (reactionsData || []).map((r: any) => {
            // The users field comes as an array from the join
            const userArray = r.users as Array<{ name: string; avatar_url: string }>;
            const userData = userArray && userArray.length > 0 ? userArray[0] : null;
            
            return {
              id: r.id,
              emoji_code: r.emoji_code,
              emoji_name: r.emoji_name,
              user_id: r.user_id,
              user_name: userData?.name,
              user_avatar: userData?.avatar_url,
              created_at: new Date().toISOString()
            };
          });

          return {
            ...msg,
            sender_name: senderName,
            sender_avatar: senderAvatar,
            reactions: reactions
          };
        })
      );

      setMessages(messagesWithDetails);
      
      await markMessagesAsRead();
      
    } catch (error: any) {
      console.error('❌ Error fetching messages:', error);
      setError('Failed to load messages: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [roomId, supabaseUserId]);

  // Mark messages as read
  const markMessagesAsRead = async () => {
    if (!roomId || !supabaseUserId) return;

    try {
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('room_id', roomId)
        .neq('sender_id', supabaseUserId)
        .eq('is_read', false);

      if (unreadMessages && unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(m => m.id);
        const now = new Date().toISOString();
        
        await supabase
          .from('messages')
          .update({ 
            is_read: true,
            read_at: now,
            delivered: true,
            delivered_at: now
          })
          .in('id', messageIds);

        await supabase
          .from('rooms')
          .update({ 
            unread_count: 0,
            last_read_at: now
          })
          .eq('id', roomId);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Send typing indicator
  const sendTypingIndicator = async (typing: boolean) => {
    if (!roomId || !supabaseUserId) return;

    try {
      await supabase
        .from('typing_indicators')
        .upsert({
          room_id: roomId,
          user_id: supabaseUserId,
          typing: typing,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  };

  // Send message
  const sendMessage = async (
    type: 'text' | 'image' | 'voice' | 'document' | 'emoji',
    content?: any,
    fileName?: string,
    fileSize?: number,
    duration?: number
  ) => {
    if (!roomId || !supabaseUserId || (!newMessage.trim() && type === 'text' && !content)) return;

    setSending(true);
    try {
      const messageData: any = {
        room_id: roomId,
        sender_id: supabaseUserId,
        sender_name: currentParticipant?.name,
        sender_avatar: currentParticipant?.avatar_url,
        sender_type: currentParticipant?.user_type,
        message_type: type,
        message_text: type === 'text' ? newMessage : 
                     type === 'image' ? '📷 Image' : 
                     type === 'voice' ? '🎤 Voice message' :
                     type === 'document' ? '📄 Document' :
                     type === 'emoji' ? content : '',
        is_read: false,
        delivered: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (replyToMessage) {
        messageData.reply_to_message_id = replyToMessage.id;
        messageData.reply_to_message_text = replyToMessage.message_text.substring(0, 100) + (replyToMessage.message_text.length > 100 ? '...' : '');
        messageData.reply_to_message_sender = replyToMessage.sender_name;
      }

      if (type === 'image' || type === 'document' || type === 'voice') {
        messageData.media_url = content;
        messageData.media_type = type;
        messageData.file_name = fileName;
        messageData.file_size = fileSize;
        messageData.duration = duration;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('rooms')
        .update({
          last_message: messageData.message_text,
          last_message_at: new Date().toISOString(),
          last_message_sender: supabaseUserId,
          last_message_type: type,
          updated_at: new Date().toISOString(),
          unread_count: 0
        })
        .eq('id', roomId);

      const newMessageWithDetails = {
        ...data,
        sender_name: currentParticipant?.name,
        sender_avatar: currentParticipant?.avatar_url,
        sender_type: currentParticipant?.user_type,
        reactions: []
      };
      
      setMessages(prev => [...prev, newMessageWithDetails]);
      
      if (type === 'text') {
        setNewMessage("");
      }
      
      if (replyToMessage) {
        setReplyToMessage(null);
      }

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Handle text message send
  const handleSendMessage = () => {
    if (newMessage.trim()) {
      sendMessage('text');
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    
    if (newMessage) {
      sendTypingIndicator(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(false);
      }, 2000);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = type === 'image' ? 10 * 1024 * 1024 : 20 * 1024 * 1024;

    if (file.size > maxSize) {
      alert(`File size too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`);
      return;
    }

    const fileId = Date.now().toString();
    const uploadProgressEntry: UploadProgress = {
      fileId,
      fileName: file.name,
      fileType: type,
      fileSize: file.size,
      uploaded: 0,
      total: file.size,
      percentage: 0,
      status: 'uploading'
    };

    setUploadProgress(prev => [...prev, uploadProgressEntry]);
    setShowUploadProgress(true);

    try {
      const simulateUpload = async () => {
        let uploaded = 0;
        const chunkSize = file.size / 100;
        
        while (uploaded < file.size) {
          await new Promise(resolve => setTimeout(resolve, 50));
          uploaded += chunkSize;
          if (uploaded > file.size) uploaded = file.size;
          
          const percentage = Math.round((uploaded / file.size) * 100);
          
          setUploadProgress(prev => prev.map(up => 
            up.fileId === fileId 
              ? { ...up, uploaded, percentage, status: 'uploading' }
              : up
          ));
        }

        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        setUploadProgress(prev => prev.map(up => 
          up.fileId === fileId 
            ? { ...up, uploaded: file.size, percentage: 100, status: 'completed' }
            : up
        ));

        // Send as the appropriate type
        sendMessage(type, base64, file.name, file.size);

        setTimeout(() => {
          setUploadProgress(prev => prev.filter(up => up.fileId !== fileId));
        }, 2000);
      };

      simulateUpload();

    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadProgress(prev => prev.map(up => 
        up.fileId === fileId 
          ? { ...up, status: 'failed' }
          : up
      ));
      alert('Failed to upload file');
    }
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      const options = { mimeType: 'audio/webm' };
      const mediaRecorder = new MediaRecorder(stream, options);
      const audioChunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });

        sendMessage('voice', base64, `voice_${Date.now()}.webm`, audioBlob.size, recording.time);
        
        stream.getTracks().forEach(track => track.stop());
        
        setRecording({
          isRecording: false,
          time: 0,
          blob: null,
          audioChunks: [],
          mediaRecorder: null,
          stream: null
        });
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        alert('Recording error occurred');
      };

      mediaRecorder.start(100);
      
      setRecording({
        isRecording: true,
        time: 0,
        blob: null,
        audioChunks: [],
        mediaRecorder,
        stream
      });
      
      recordingIntervalRef.current = setInterval(() => {
        setRecording(prev => ({ 
          ...prev, 
          time: prev.time + 1 
        }));
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        alert('Could not access microphone. Please check permissions.');
      }
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (recording.mediaRecorder && recording.isRecording) {
      recording.mediaRecorder.stop();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  // Cancel voice recording
  const cancelRecording = () => {
    if (recording.mediaRecorder && recording.isRecording) {
      recording.mediaRecorder.stop();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      
      if (recording.stream) {
        recording.stream.getTracks().forEach(track => track.stop());
      }
      
      setRecording({
        isRecording: false,
        time: 0,
        blob: null,
        audioChunks: [],
        mediaRecorder: null,
        stream: null
      });
    }
  };

  // Play/Pause audio
  const toggleAudioPlayback = (messageId: string, audioUrl: string) => {
    if (!audioElements[messageId]) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setPlayingAudioId(null);
      audio.onerror = () => {
        console.error('Audio playback error');
        setPlayingAudioId(null);
      };
      setAudioElements(prev => ({ ...prev, [messageId]: audio }));
    }

    const audio = audioElements[messageId] || new Audio(audioUrl);
    
    if (playingAudioId === messageId) {
      audio.pause();
      setPlayingAudioId(null);
    } else {
      if (playingAudioId && audioElements[playingAudioId]) {
        audioElements[playingAudioId].pause();
        audioElements[playingAudioId].currentTime = 0;
      }
      
      audio.play()
        .then(() => {
          setPlayingAudioId(messageId);
          audio.onended = () => setPlayingAudioId(null);
        })
        .catch(err => {
          console.error('Error playing audio:', err);
          setPlayingAudioId(null);
        });
    }
  };

  // Delete message for me
  const deleteMessageForMe = async (messageId: string) => {
    if (!supabaseUserId) return;

    try {
      const { data: messageData } = await supabase
        .from('messages')
        .select('deleted_for')
        .eq('id', messageId)
        .single();

      const currentDeletedFor = messageData?.deleted_for || [];
      
      const { error } = await supabase
        .from('messages')
        .update({
          deleted_for: [...currentDeletedFor, supabaseUserId],
          deleted_at: new Date().toISOString(),
          deleted_by: supabaseUserId
        })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setShowMessageActions(false);
      setSelectedMessage(null);

    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message');
    }
  };

  // Delete message for everyone
  const deleteMessageForEveryone = async (messageId: string) => {
    if (!supabaseUserId) return;

    try {
      const { data: messageData } = await supabase
        .from('messages')
        .select('created_at, sender_id')
        .eq('id', messageId)
        .single();

      if (messageData) {
        const messageTime = new Date(messageData.created_at).getTime();
        const currentTime = new Date().getTime();
        const timeDiff = currentTime - messageTime;
        const twoMinutes = 2 * 60 * 1000;

        if (timeDiff > twoMinutes) {
          alert('You can only delete messages for everyone within 2 minutes of sending.');
          return;
        }

        if (messageData.sender_id !== supabaseUserId) {
          alert('You can only delete your own messages for everyone.');
          return;
        }
      }

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setShowMessageActions(false);
      setSelectedMessage(null);

    } catch (error) {
      console.error('Error deleting message for everyone:', error);
      alert('Failed to delete message');
    }
  };

  // Copy message text
  const copyMessageText = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('Message copied to clipboard');
        setShowMessageActions(false);
      })
      .catch(err => console.error('Failed to copy:', err));
  };

  // Star message function
  const starMessageFunction = async (messageId: string) => {
    if (!supabaseUserId) return;

    try {
      const { data: messageData } = await supabase
        .from('messages')
        .select('starred_by')
        .eq('id', messageId)
        .single();

      const currentStarredBy = messageData?.starred_by || [];
      
      if (currentStarredBy.includes(supabaseUserId)) {
        const { error } = await supabase
          .from('messages')
          .update({
            starred_by: currentStarredBy.filter((id: string) => id !== supabaseUserId)
          })
          .eq('id', messageId);

        if (error) throw error;

        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, starred_by: currentStarredBy.filter((id: string) => id !== supabaseUserId) }
            : msg
        ));

      } else {
        const { error } = await supabase
          .from('messages')
          .update({
            starred_by: [...currentStarredBy, supabaseUserId]
          })
          .eq('id', messageId);

        if (error) throw error;

        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, starred_by: [...currentStarredBy, supabaseUserId] }
            : msg
        ));
      }

      setShowMessageActions(false);

    } catch (error) {
      console.error('Error starring message:', error);
      alert('Failed to star message');
    }
  };

  // Pin message function
  const pinMessageFunction = async (messageId: string) => {
    if (!supabaseUserId) return;

    try {
      await supabase
        .from('messages')
        .update({
          pinned: false,
          pinned_at: null,
          pinned_by: null
        })
        .eq('room_id', roomId)
        .eq('pinned', true);

      const { error } = await supabase
        .from('messages')
        .update({
          pinned: true,
          pinned_at: new Date().toISOString(),
          pinned_by: supabaseUserId
        })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, pinned: true, pinned_at: new Date().toISOString(), pinned_by: supabaseUserId }
          : { ...msg, pinned: false, pinned_at: undefined, pinned_by: undefined }
      ));

      setShowMessageActions(false);

    } catch (error) {
      console.error('Error pinning message:', error);
      alert('Failed to pin message');
    }
  };

  // Unpin message
  const unpinMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          pinned: false,
          pinned_at: null,
          pinned_by: null
        })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, pinned: false, pinned_at: undefined, pinned_by: undefined }
          : msg
      ));

    } catch (error) {
      console.error('Error unpinning message:', error);
      alert('Failed to unpin message');
    }
  };

  // Add reaction to message
  const addReaction = async (messageId: string, emojiCode: string, emojiName: string) => {
    if (!supabaseUserId) return;

    try {
      const { data: existingReaction } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', supabaseUserId)
        .eq('emoji_code', emojiCode)
        .maybeSingle();

      if (existingReaction) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) throw error;

        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                reactions: msg.reactions?.filter(r => 
                  !(r.user_id === supabaseUserId && r.emoji_code === emojiCode)
                ) || [] 
              }
            : msg
        ));

      } else {
        const { data: reactionData, error } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: supabaseUserId,
            emoji_code: emojiCode,
            emoji_name: emojiName
          })
          .select()
          .single();

        if (error) throw error;

        const { data: userData } = await supabase
          .from('users')
          .select('name, avatar_url')
          .eq('id', supabaseUserId)
          .maybeSingle();

        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                reactions: [
                  ...(msg.reactions || []),
                  {
                    id: reactionData.id,
                    emoji_code: reactionData.emoji_code,
                    emoji_name: reactionData.emoji_name,
                    user_id: reactionData.user_id,
                    user_name: userData?.name,
                    user_avatar: userData?.avatar_url,
                    created_at: new Date().toISOString()
                  }
                ]
              }
            : msg
        ));
      }

    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  // Handle message click
  const handleMessageClick = (message: Message, e: React.MouseEvent) => {
    if (e.type === 'contextmenu' || e.button === 2) {
      e.preventDefault();
      setSelectedMessage(message);
      setShowMessageActions(true);
    }
  };

  // Handle user authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const { id, data } = await getSupabaseUserId(currentUser.uid);
          setSupabaseUserId(id);
          setSupabaseUserData(data);
          setCurrentParticipant({
            id: id,
            name: data.name || 'User',
            avatar_url: data.avatar_url,
            user_type: data.user_type || 'user',
            firebase_uid: data.firebase_uid,
            is_online: data.is_active,
            last_seen: data.last_seen,
            typing: false
          });
        } catch (error) {
          console.error('Auth error:', error);
          navigate('/login');
        }
      } else {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Fetch initial data
  useEffect(() => {
    if (roomId && supabaseUserId && supabaseUserData) {
      fetchRoomDetails(supabaseUserId, supabaseUserData);
      fetchMessages();
      fetchEmojis();
    }
  }, [roomId, supabaseUserId, supabaseUserData, fetchRoomDetails, fetchMessages]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!roomId || !supabaseUserId) return;

    const messagesChannel = supabase
      .channel(`room:${roomId}:messages`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        }, 
        async (payload) => {
          const newMessage = payload.new as Message;
          
          if (newMessage.deleted_for?.includes(supabaseUserId)) {
            return;
          }

          let senderName = newMessage.sender_name;
          let senderAvatar = newMessage.sender_avatar;

          if (!senderName || !senderAvatar) {
            const { data: senderData } = await supabase
              .from('users')
              .select('name, avatar_url, user_type')
              .eq('id', newMessage.sender_id)
              .maybeSingle();

            if (senderData) {
              senderName = senderData.name;
              senderAvatar = senderData.avatar_url;
            }
          }

          const messageWithDetails = {
            ...newMessage,
            sender_name: senderName,
            sender_avatar: senderAvatar,
            reactions: []
          };

          setMessages(prev => [...prev, messageWithDetails]);
          
          if (newMessage.sender_id !== supabaseUserId) {
            markMessagesAsRead();
          }
          
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          const updatedMessage = payload.new as Message;
          
          if (updatedMessage.deleted_for?.includes(supabaseUserId)) {
            setMessages(prev => prev.filter(msg => msg.id !== updatedMessage.id));
            return;
          }

          setMessages(prev => prev.map(msg => 
            msg.id === updatedMessage.id 
              ? { ...msg, ...updatedMessage }
              : msg
          ));
        }
      );

    const typingChannel = supabase
      .channel(`room:${roomId}:typing`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          const newData = payload.new as TypingIndicator;
          if (newData && newData.user_id !== supabaseUserId) {
            setIsTyping(newData.typing);
          }
        }
      );

    messagesChannel.subscribe();
    typingChannel.subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [roomId, supabaseUserId]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages]);

  // Handle typing indicator timeout
  useEffect(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (newMessage) {
      setIsTyping(true);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 2000);
    } else {
      setIsTyping(false);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [newMessage]);

  // Close pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      if (recording.mediaRecorder && recording.isRecording) {
        recording.mediaRecorder.stop();
      }
      
      if (recording.stream) {
        recording.stream.getTracks().forEach(track => track.stop());
      }
      
      Object.values(audioElements).forEach(audio => {
        audio.pause();
        audio.src = '';
        audio.load();
      });
    };
  }, [recording.mediaRecorder, recording.isRecording, recording.stream, audioElements]);

  // Format time
  const formatTime = (timestamp: string) => {
    const date = parseISO(timestamp);
    return format(date, 'h:mm a');
  };

  // Format date
  const formatDate = (timestamp: string) => {
    const date = parseISO(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return format(date, 'MMMM d, yyyy');
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const date = formatDate(message.created_at);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });

    return groups;
  };

  if (loading && messages.length === 0) {
    return (
      <div className="chatroom-loading">
        <div className="chatroom-spinner"></div>
        <p>Loading chat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chatroom-error">
        <AlertCircle size={24} />
        <p>{error}</p>
        <button 
          className="chatroom-retry"
          onClick={() => {
            setError(null);
            if (supabaseUserId && supabaseUserData) {
              fetchRoomDetails(supabaseUserId, supabaseUserData);
              fetchMessages();
            }
          }}
        >
          Retry
        </button>
        <button 
          className="chatroom-back-btn"
          onClick={() => navigate('/chats')}
        >
          Back to Chats
        </button>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate();

  return (
    <div className="chatroom-container">
      {/* Header */}
      <div className="chatroom-header">
        <div className="chatroom-header-left">
          <button 
            className="chatroom-back"
            onClick={() => navigate('/chats')}
          >
            <ArrowLeft size={16} />
          </button>
          
          <div className="chatroom-userinfo">
            <div className="chatroom-userpic">
              {otherParticipant?.avatar_url ? (
                <img 
                  src={otherParticipant.avatar_url} 
                  alt={otherParticipant.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
              {(!otherParticipant?.avatar_url) && (
                <div className="chatroom-userpic-placeholder">
                  {otherParticipant?.user_type === 'vendor' ? <Store size={12} /> : <User size={12} />}
                </div>
              )}
              {otherParticipant?.is_online && (
                <div className="chatroom-online"></div>
              )}
            </div>
            
            <div className="chatroom-userdetails">
              <h2 className="chatroom-username">
                {otherParticipant?.shop_name || otherParticipant?.name || 'Unknown'}
              </h2>
              <p className="chatroom-userstatus">
                {isTyping ? (
                  <span className="chatroom-typing">typing...</span>
                ) : otherParticipant?.is_online ? (
                  <span className="chatroom-online-text">online</span>
                ) : otherParticipant?.last_seen ? (
                  `last seen ${formatDistanceToNow(parseISO(otherParticipant.last_seen))} ago`
                ) : (
                  'offline'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="chatroom-header-right">
          <button className="chatroom-header-btn" title="Call">
            <Phone size={14} />
          </button>
          
          <button className="chatroom-header-btn" title="Video">
            <Video size={14} />
          </button>
          
          <button 
            className="chatroom-header-btn" 
            title="Search"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search size={14} />
          </button>
          
          <button 
            className="chatroom-header-btn" 
            title="Info"
            onClick={() => setShowInfoPanel(!showInfoPanel)}
          >
            <Info size={14} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="chatroom-search-bar">
          <div className="chatroom-search-input-wrapper">
            <Search size={12} />
            <input
              type="text"
              placeholder="Search in conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="chatroom-search-input"
            />
            {searchQuery && (
              <button 
                className="chatroom-search-clear"
                onClick={() => setSearchQuery("")}
              >
                <X size={10} />
              </button>
            )}
          </div>
          <button 
            className="chatroom-search-close"
            onClick={() => setShowSearch(false)}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Reply Preview */}
      {replyToMessage && (
        <div className="chatroom-reply-preview">
          <div className="chatroom-reply-preview-content">
            <div className="chatroom-reply-preview-header">
              <span className="chatroom-reply-preview-sender">
                {replyToMessage.sender_id === supabaseUserId ? 'You' : replyToMessage.sender_name}
              </span>
            </div>
            <div className="chatroom-reply-preview-message">
              {replyToMessage.message_type === 'image' && '📷 Image'}
              {replyToMessage.message_type === 'voice' && '🎤 Voice message'}
              {replyToMessage.message_type === 'document' && '📄 Document'}
              {replyToMessage.message_type === 'text' && replyToMessage.message_text}
            </div>
          </div>
          <button 
            className="chatroom-reply-preview-cancel"
            onClick={() => setReplyToMessage(null)}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div 
        className="chatroom-messages" 
        ref={messagesContainerRef}
        onContextMenu={(e) => e.preventDefault()}
      >
        {Object.entries(messageGroups).map(([date, dateMessages]) => (
          <div key={date} className="chatroom-date-group">
            <div className="chatroom-date">
              <span>{date}</span>
            </div>
            
            {dateMessages.map((message) => {
              const isOwnMessage = message.sender_id === supabaseUserId;
              
              return (
                <div 
                  key={message.id} 
                  className={`chatroom-message ${isOwnMessage ? 'own' : 'other'}`}
                  onContextMenu={(e) => handleMessageClick(message, e)}
                >
                  {!isOwnMessage && otherParticipant?.avatar_url && (
                    <div className="chatroom-message-avatar">
                      <img 
                        src={otherParticipant.avatar_url} 
                        alt={otherParticipant.name}
                      />
                    </div>
                  )}
                  
                  <div className="chatroom-message-wrapper">
                    {message.reply_to_message_id && (
                      <div className="chatroom-message-reply">
                        <div className="chatroom-message-reply-line"></div>
                        <div className="chatroom-message-reply-content">
                          <span className="chatroom-message-reply-sender">
                            {message.reply_to_message_sender}
                          </span>
                          <span className="chatroom-message-reply-text">
                            {message.reply_to_message_text}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className={`chatroom-bubble ${isOwnMessage ? 'own' : 'other'}`}>
                      {message.message_type === 'image' && message.media_url && (
                        <div className="chatroom-image">
                          <img 
                            src={message.media_url} 
                            alt="Shared image"
                            onClick={() => window.open(message.media_url, '_blank')}
                          />
                          {message.caption && (
                            <div className="chatroom-image-caption">
                              {message.caption}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {message.message_type === 'voice' && message.media_url && (
                        <div className="chatroom-voice">
                          <button 
                            className="chatroom-voice-play"
                            onClick={() => toggleAudioPlayback(message.id, message.media_url!)}
                          >
                            {playingAudioId === message.id ? (
                              <Pause size={12} />
                            ) : (
                              <Play size={12} />
                            )}
                          </button>
                          <div className="chatroom-voice-wave">
                            <div className="chatroom-voice-bar"></div>
                            <div className="chatroom-voice-bar"></div>
                            <div className="chatroom-voice-bar"></div>
                            <div className="chatroom-voice-bar"></div>
                            <div className="chatroom-voice-bar"></div>
                          </div>
                          <span className="chatroom-voice-time">
                            {message.duration ? `0:${message.duration.toString().padStart(2, '0')}` : '0:00'}
                          </span>
                        </div>
                      )}
                      
                      {message.message_type === 'document' && message.media_url && (
                        <div className="chatroom-document">
                          <div className="chatroom-document-icon">
                            <FileText size={16} />
                          </div>
                          <div className="chatroom-document-info">
                            <span className="chatroom-document-name">
                              {message.file_name}
                            </span>
                            <span className="chatroom-document-size">
                              {formatFileSize(message.file_size || 0)}
                            </span>
                          </div>
                          <button 
                            className="chatroom-document-download"
                            onClick={() => window.open(message.media_url, '_blank')}
                            title="Download"
                          >
                            <Download size={12} />
                          </button>
                        </div>
                      )}
                      
                      {message.message_type === 'text' && message.message_text && (
                        <p className="chatroom-text">{message.message_text}</p>
                      )}
                      
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="chatroom-reactions">
                          {message.reactions.map(reaction => (
                            <span 
                              key={reaction.id} 
                              className="chatroom-reaction"
                              title={`${reaction.user_name}: ${reaction.emoji_name}`}
                            >
                              {reaction.emoji_code}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="chatroom-meta">
                        <span className="chatroom-time">
                          {formatTime(message.created_at)}
                        </span>
                        
                        {isOwnMessage && (
                          <div className="chatroom-status">
                            {message.is_read ? (
                              <CheckCheck size={10} className="chatroom-read" />
                            ) : message.delivered ? (
                              <CheckCheck size={10} className="chatroom-delivered" />
                            ) : (
                              <Check size={10} className="chatroom-sent" />
                            )}
                          </div>
                        )}

                        {message.starred_by?.includes(supabaseUserId || '') && (
                          <div className="chatroom-starred">
                            <Star size={8} fill="#ffc107" stroke="#ffc107" />
                          </div>
                        )}

                        {message.pinned && (
                          <div className="chatroom-pinned">
                            <Pin size={8} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Upload Progress */}
      {showUploadProgress && uploadProgress.length > 0 && (
        <div className="chatroom-upload-progress">
          {uploadProgress.map(upload => (
            <div key={upload.fileId} className="chatroom-upload-item">
              <div className="chatroom-upload-info">
                <span className="chatroom-upload-name">{upload.fileName}</span>
                <span className="chatroom-upload-status">{upload.status}</span>
              </div>
              <div className="chatroom-upload-bar">
                <div 
                  className="chatroom-upload-progress-bar"
                  style={{ width: `${upload.percentage}%` }}
                ></div>
              </div>
              <span className="chatroom-upload-percentage">{upload.percentage}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Recording UI */}
      {recording.isRecording && (
        <div className="chatroom-recording-ui">
          <div className="chatroom-recording-timer">
            <div className="chatroom-recording-dot"></div>
            <span className="chatroom-recording-time">{recording.time}s</span>
          </div>
          <span className="chatroom-recording-text">
            Recording... Tap to send
          </span>
          <button 
            className="chatroom-recording-cancel"
            onClick={cancelRecording}
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="chatroom-input">
        <div className="chatroom-input-left">
          <div className="chatroom-emoji-wrapper" ref={emojiPickerRef}>
            <button 
              className="chatroom-input-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Emoji"
            >
              <Smile size={14} />
            </button>
            
            {showEmojiPicker && (
              <div className="chatroom-emoji-picker">
                <div className="chatroom-emoji-grid">
                  {emojis.slice(0, 48).map(emoji => (
                    <button
                      key={emoji.id}
                      className="chatroom-emoji"
                      onClick={() => {
                        sendMessage('emoji', emoji.code);
                        setShowEmojiPicker(false);
                      }}
                      title={emoji.name}
                    >
                      {emoji.code}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <button 
            className="chatroom-input-btn"
            onClick={() => imageInputRef.current?.click()}
            title="Photo"
          >
            <ImageIcon size={14} />
          </button>

          <input
            type="file"
            ref={imageInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={(e) => handleFileUpload(e, 'image')}
          />
          <input
            type="file"
            ref={documentInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.txt"
            onChange={(e) => handleFileUpload(e, 'document')}
          />
        </div>
        
        <div className="chatroom-input-center">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="chatroom-input-field"
            disabled={sending || recording.isRecording}
          />
        </div>
        
        <div className="chatroom-input-right">
          {!newMessage.trim() && !recording.isRecording && (
            <button 
              className="chatroom-input-btn"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              title="Hold to record"
            >
              <Mic size={14} />
            </button>
          )}
          
          {(newMessage.trim() || recording.isRecording) && (
            <button 
              className="chatroom-send"
              onClick={recording.isRecording ? stopRecording : handleSendMessage}
              disabled={sending}
            >
              {sending ? (
                <div className="chatroom-send-spinner"></div>
              ) : (
                <Send size={12} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Message Actions Modal */}
      {showMessageActions && selectedMessage && (
        <div className="chatroom-message-actions-modal">
          <div className="chatroom-message-actions">
            <button 
              className="chatroom-action-btn"
              onClick={() => {
                if (selectedMessage.message_text) {
                  copyMessageText(selectedMessage.message_text);
                }
              }}
            >
              <Copy size={12} />
              <span>Copy</span>
            </button>
            
            <button 
              className="chatroom-action-btn"
              onClick={() => {
                setReplyToMessage(selectedMessage);
                setShowMessageActions(false);
                inputRef.current?.focus();
              }}
            >
              <Reply size={12} />
              <span>Reply</span>
            </button>
            
            <button 
              className="chatroom-action-btn"
              onClick={() => {
                setForwardMessage(selectedMessage);
                setShowMessageActions(false);
              }}
            >
              <Share2 size={12} />
              <span>Forward</span>
            </button>
            
            <button 
              className="chatroom-action-btn"
              onClick={() => {
                starMessageFunction(selectedMessage.id);
              }}
            >
              <Star size={12} />
              <span>{selectedMessage.starred_by?.includes(supabaseUserId || '') ? 'Unstar' : 'Star'}</span>
            </button>
            
            <button 
              className="chatroom-action-btn"
              onClick={() => {
                if (selectedMessage.pinned) {
                  unpinMessage(selectedMessage.id);
                } else {
                  pinMessageFunction(selectedMessage.id);
                }
              }}
            >
              <Pin size={12} />
              <span>{selectedMessage.pinned ? 'Unpin' : 'Pin'}</span>
            </button>
            
            {selectedMessage.sender_id === supabaseUserId && (
              <button 
                className="chatroom-action-btn chatroom-action-delete"
                onClick={() => {
                  if (window.confirm('Delete for everyone? (Only within 2 minutes)')) {
                    deleteMessageForEveryone(selectedMessage.id);
                  }
                }}
              >
                <Trash2 size={12} />
                <span>Delete for everyone</span>
              </button>
            )}
            
            <button 
              className="chatroom-action-btn chatroom-action-delete"
              onClick={() => deleteMessageForMe(selectedMessage.id)}
            >
              <Trash2 size={12} />
              <span>Delete for me</span>
            </button>
            
            <button 
              className="chatroom-action-btn chatroom-action-close"
              onClick={() => setShowMessageActions(false)}
            >
              <X size={12} />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Info Panel */}
      {showInfoPanel && roomDetails && (
        <div className="chatroom-info">
          <div className="chatroom-info-header">
            <h3>Chat Info</h3>
            <button 
              className="chatroom-info-close"
              onClick={() => setShowInfoPanel(false)}
            >
              <X size={12} />
            </button>
          </div>
          
          <div className="chatroom-info-content">
            <div className="chatroom-info-section">
              <h4>Participant</h4>
              <div className="chatroom-info-user">
                <div className="chatroom-info-pic">
                  {otherParticipant?.avatar_url ? (
                    <img 
                      src={otherParticipant.avatar_url} 
                      alt={otherParticipant.name}
                    />
                  ) : (
                    <div className="chatroom-info-pic-placeholder">
                      {otherParticipant?.user_type === 'vendor' ? <Store size={16} /> : <User size={16} />}
                    </div>
                  )}
                </div>
                <div className="chatroom-info-details">
                  <span className="chatroom-info-name">
                    {otherParticipant?.shop_name || otherParticipant?.name}
                  </span>
                  <span className="chatroom-info-type">
                    {otherParticipant?.user_type === 'vendor' ? 'Shop' : 'User'}
                  </span>
                  <span className={`chatroom-info-status ${otherParticipant?.is_online ? 'online' : 'offline'}`}>
                    {otherParticipant?.is_online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="chatroom-info-section">
              <h4>Chat Details</h4>
              <div className="chatroom-info-stats">
                <div className="chatroom-info-stat">
                  <span>Chat Type:</span>
                  <span>{roomDetails.chat_type}</span>
                </div>
                <div className="chatroom-info-stat">
                  <span>Created:</span>
                  <span>{format(parseISO(roomDetails.created_at), 'MMM d, yyyy')}</span>
                </div>
                <div className="chatroom-info-stat">
                  <span>Messages:</span>
                  <span>{messages.length}</span>
                </div>
              </div>
            </div>
            
            {roomDetails.product_name && (
              <div className="chatroom-info-section">
                <h4>Product</h4>
                <div className="chatroom-info-product">
                  {roomDetails.product_image && (
                    <img 
                      src={roomDetails.product_image} 
                      alt={roomDetails.product_name}
                      className="chatroom-info-product-img"
                    />
                  )}
                  <span className="chatroom-info-product-name">
                    {roomDetails.product_name}
                  </span>
                </div>
              </div>
            )}
            
            <div className="chatroom-info-actions">
              <button className="chatroom-info-btn">
                <Bell size={12} />
                <span>{roomDetails.unread_count ? 'Mute' : 'Unmute'}</span>
              </button>
              <button className="chatroom-info-btn">
                <Archive size={12} />
                <span>Archive</span>
              </button>
              <button className="chatroom-info-btn chatroom-info-btn-danger">
                <Shield size={12} />
                <span>Block</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}