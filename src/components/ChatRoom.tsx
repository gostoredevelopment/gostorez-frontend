import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { format, formatDistanceToNow, parseISO, isValid } from "date-fns";

import { callService } from '../services/callService';

import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon,
  Mic, 
  MoreVertical,
  Check,
  CheckCheck,
  User,
  Store,
  Phone,
  Video,
  Info,
  X,
  Clock,
  AlertCircle,
  Shield,
  Search,
  Paperclip,
  Smile,
  Volume2,
  File,
  XCircle,
  Copy,
  Trash2,
  Share2,
  CornerUpLeft,
  Ban,
  Flag,
  VolumeX,
  VideoOff,
  Bell,
  BellOff
} from "lucide-react";
import "./ChatRoom.css";
import { notificationService } from '../services/notificationService';

type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: 'text' | 'image' | 'voice' | 'file' | 'offer' | 'system';
  message_text: string;
  media_url?: string;
  media_type?: string;
  file_name?: string;
  file_size?: number;
  is_read: boolean;
  read_at?: string;
  delivered: boolean;
  delivered_at?: string;
  metadata?: Record<string, any>;
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
  is_online?: boolean;
  last_seen?: string;
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
  status_a?: 'online' | 'offline' | 'typing';
  status_b?: 'online' | 'offline' | 'typing';
};

type Emoji = {
  id: string;
  emoji: string;
  category: string;
  name: string;
  keywords: string[];
};

type SelectedMessage = {
  id: string;
  sender_id: string;
  message_text: string;
  message_type: string;
  media_url?: string;
  file_name?: string;
};

type CallType = 'voice' | 'video' | null;

type Notification = {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  duration?: number;
};

// Helper function to get Firebase UID from any participant (user or vendor)
const getParticipantFirebaseUid = async (participantId: string): Promise<string | null> => {
  try {
    // First check users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('firebase_uid')
      .eq('id', participantId)
      .maybeSingle();

    if (!userError && userData?.firebase_uid) {
      return userData.firebase_uid;
    }

    // If not found, check if it's a vendor (vendor_profiles id = participantId)
    const { data: vendorData, error: vendorError } = await supabase
      .from('vendor_profiles')
      .select('user_id')
      .eq('id', participantId)
      .maybeSingle();

    if (!vendorError && vendorData?.user_id) {
      // This user_id is the firebase_uid
      return vendorData.user_id;
    }

    // Also check if participantId itself is a firebase_uid (direct match)
    const { data: directUserData, error: directError } = await supabase
      .from('users')
      .select('firebase_uid')
      .eq('firebase_uid', participantId)
      .maybeSingle();

    if (!directError && directUserData?.firebase_uid) {
      return directUserData.firebase_uid;
    }

    return null;
  } catch (error) {
    console.error('Error getting participant Firebase UID:', error);
    return null;
  }
};

export default function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  const [user, setUser] = useState<any>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<Participant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [otherIsRecording, setOtherIsRecording] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [filteredEmojis, setFilteredEmojis] = useState<Emoji[]>([]);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  const [selectedMessages, setSelectedMessages] = useState<SelectedMessage[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<SelectedMessage | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [showCallOptions, setShowCallOptions] = useState(false);
  const [activeCall, setActiveCall] = useState<CallType>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connected' | 'ended'>('idle');
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [onlineStatus, setOnlineStatus] = useState<{is_online: boolean, last_seen: string}>({is_online: false, last_seen: ''});
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [sentMessageIds, setSentMessageIds] = useState<Set<string>>(new Set());
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  const sentSoundRef = useRef<HTMLAudioElement | null>(null);
  const receivedSoundRef = useRef<HTMLAudioElement | null>(null);
  const typingSoundRef = useRef<HTMLAudioElement | null>(null);
  const callSoundRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onlineStatusRef = useRef<NodeJS.Timeout | null>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoScrollRef = useRef<boolean>(true);
  const initialLoadRef = useRef<boolean>(true);

  // Initialize sounds with error handling
  useEffect(() => {
    // Create audio elements with fallback
    try {
      sentSoundRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-message-pop-alert-2354.mp3');
      receivedSoundRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3');
      typingSoundRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3');
      callSoundRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-phone-ring-3002.mp3');
      
      [sentSoundRef.current, receivedSoundRef.current, typingSoundRef.current, callSoundRef.current].forEach(audio => {
        if (audio) {
          audio.volume = 0.3;
          audio.preload = 'auto';
        }
      });
    } catch (e) {
      console.warn('Could not initialize audio:', e);
    }
    
    return () => {
      [sentSoundRef.current, receivedSoundRef.current, typingSoundRef.current, callSoundRef.current].forEach(audio => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      });
    };
  }, []);

  const playSound = (type: 'sent' | 'received' | 'typing' | 'call') => {
    if (!audioEnabled) return;
    
    try {
      let audio: HTMLAudioElement | null = null;
      switch(type) {
        case 'sent': audio = sentSoundRef.current; break;
        case 'received': audio = receivedSoundRef.current; break;
        case 'typing': audio = typingSoundRef.current; break;
        case 'call': audio = callSoundRef.current; break;
      }
      
      if (audio) {
        audio.currentTime = 0;
        // Create a promise to handle autoplay restrictions
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Ignore autoplay errors - will play on user interaction
          });
        }
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const stopCallSound = () => {
    if (callSoundRef.current) {
      callSoundRef.current.pause();
      callSoundRef.current.currentTime = 0;
      callSoundRef.current.loop = false;
    }
  };

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    const newNotification: Notification = { ...notification, id };
    setNotifications(prev => [...prev, newNotification]);
    
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, notification.duration || 3000);
  };

  const getSupabaseUserId = async (firebaseUid: string): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('firebase_uid', firebaseUid)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('User not found in Supabase');
      return data.id;
    } catch (error) {
      console.error('Error getting Supabase user ID:', error);
      throw error;
    }
  };

  const updateRoomStatus = async (status: 'online' | 'offline' | 'typing') => {
    if (!supabaseUserId || !roomDetails) return;
    
    try {
      const now = new Date().toISOString();
      const isParticipantA = roomDetails.p_a === supabaseUserId;
      
      const updateData: any = {
        updated_at: now
      };
      
      if (isParticipantA) {
        updateData.status_a = status;
      } else {
        updateData.status_b = status;
      }
      
      await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', roomDetails.id);
      
      // Update local state
      setRoomDetails(prev => {
        if (!prev) return prev;
        if (isParticipantA) {
          return { ...prev, status_a: status, updated_at: now };
        } else {
          return { ...prev, status_b: status, updated_at: now };
        }
      });
      
    } catch (error) {
      console.error('Error updating room status:', error);
    }
  };

  const fetchRoomDetails = useCallback(async (userId: string) => {
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

      const isParticipantA = roomData.p_a === userId;
      const otherParticipantId = isParticipantA ? roomData.p_b : roomData.p_a;
      
      let participant: Participant = {
        id: otherParticipantId,
        name: isParticipantA ? roomData.p_b_name : roomData.p_a_name,
        avatar_url: isParticipantA ? roomData.p_b_image : roomData.p_a_image,
        user_type: 'user',
        is_online: false,
        last_seen: new Date().toISOString()
      };

      try {
        const { data: otherUserData } = await supabase
          .from('users')
          .select('*')
          .eq('id', otherParticipantId)
          .maybeSingle();

        if (otherUserData) {
          participant.user_type = otherUserData.user_type || 'user';
          participant.firebase_uid = otherUserData.firebase_uid;
          participant.is_online = otherUserData.is_active;
          participant.last_seen = otherUserData.last_seen || new Date().toISOString();
          setOnlineStatus({
            is_online: otherUserData.is_active || false,
            last_seen: otherUserData.last_seen || new Date().toISOString()
          });
        } else {
          if (roomData.chat_type === 'user_vendor' || roomData.chat_type === 'vendor_vendor') {
            participant.user_type = 'vendor';
          }
        }
      } catch (userFetchError) {
        console.log("Could not fetch user details:", userFetchError);
      }

      if (participant.user_type === 'vendor') {
        try {
          // For vendors, get the vendor profile using the ID
          const { data: vendorData } = await supabase
            .from('vendor_profiles')
            .select('user_id, shop_name, profile_image')
            .eq('id', otherParticipantId)
            .maybeSingle();

          if (vendorData) {
            participant.firebase_uid = vendorData.user_id; // This is the firebase_uid of the shop owner
            participant.shop_name = vendorData.shop_name;
            participant.avatar_url = vendorData.profile_image || participant.avatar_url;
            
            // Get the shop owner's online status from users table
            const { data: ownerData } = await supabase
              .from('users')
              .select('is_active, last_seen')
              .eq('firebase_uid', vendorData.user_id)
              .maybeSingle();

            if (ownerData) {
              participant.is_online = ownerData.is_active;
              participant.last_seen = ownerData.last_seen || new Date().toISOString();
              setOnlineStatus({
                is_online: ownerData.is_active || false,
                last_seen: ownerData.last_seen || new Date().toISOString()
              });
            }
          }
        } catch (shopError) {
          console.log("Could not fetch shop details:", shopError);
        }
      }

      setOtherParticipant(participant);

    } catch (error: any) {
      console.error('Error fetching room details:', error);
      addNotification({
        type: 'error',
        message: 'Failed to load chat details',
        duration: 3000
      });
    }
  }, [roomId]);

  const fetchMessages = useCallback(async () => {
    if (!roomId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const messageIds = data?.map(msg => msg.id) || [];
      setSentMessageIds(new Set(messageIds));
      setMessages(data || []);
      
      await markMessagesAsRead();
      
      // Scroll to bottom on initial load after messages are loaded
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
          autoScrollRef.current = true;
        }
        initialLoadRef.current = false;
      }, 100);
      
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      addNotification({
        type: 'error',
        message: 'Failed to load messages',
        duration: 3000
      });
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const markMessagesAsRead = async () => {
    if (!roomId || !supabaseUserId) return;

    try {
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('id, sender_id')
        .eq('room_id', roomId)
        .neq('sender_id', supabaseUserId)
        .eq('is_read', false);

      if (unreadMessages && unreadMessages.length > 0) {
        const now = new Date().toISOString();
        const messageIds = unreadMessages.map(msg => msg.id);
        
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
          .update({ unread_count: 0 })
          .eq('id', roomId);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async (type: 'text' | 'image' | 'voice' | 'file' = 'text', content?: any, fileName?: string, fileSize?: number) => {
    if (!roomId || !supabaseUserId || (!newMessage.trim() && type === 'text' && !content)) return;

    setSending(true);
    try {
      const messageData: any = {
        room_id: roomId,
        sender_id: supabaseUserId,
        message_type: type,
        message_text: type === 'text' ? newMessage : 
                     type === 'image' ? '[Image]' : 
                     type === 'voice' ? '[Voice message]' : 
                     '[File]',
        is_read: false,
        delivered: false,
        created_at: new Date().toISOString()
      };

      if (replyToMessage) {
        messageData.metadata = {
          ...messageData.metadata,
          reply_to: {
            message_id: replyToMessage.id,
            message_text: replyToMessage.message_text,
            sender_id: replyToMessage.sender_id
          }
        };
      }

      if (type === 'image' && content) {
        messageData.media_url = content;
        messageData.media_type = 'image';
        if (fileName) messageData.file_name = fileName;
      } else if (type === 'voice' && content) {
        messageData.media_url = content;
        messageData.media_type = 'audio';
        messageData.file_name = fileName || `voice_${Date.now()}.webm`;
      } else if (type === 'file' && content) {
        messageData.media_url = content;
        messageData.media_type = 'file';
        messageData.file_name = fileName;
        messageData.file_size = fileSize;
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
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId);

      setSentMessageIds(prev => new Set(Array.from(prev).concat(data.id)));
      
      setMessages(prev => {
        if (prev.some(msg => msg.id === data.id)) {
          return prev;
        }
        return [...prev, data];
      });
      
      if (type === 'text') {
        setNewMessage("");
        setReplyToMessage(null);
      }

      if (type === 'file') {
        setSelectedFile(null);
      }

      playSound('sent');

      // Send comprehensive notification to the other participant
      if (otherParticipant) {
        // Get the Firebase UID for the recipient (whether user or vendor)
        const recipientFirebaseUid = await getParticipantFirebaseUid(otherParticipant.id);
        
        if (recipientFirebaseUid) {
          // Prepare notification data for push and in-app
          const notificationData: any = {
            title: `New message from ${otherParticipant.shop_name || otherParticipant.name || 'User'}`,
            body: messageData.message_text.substring(0, 100),
            notification_type: 'chat',
            redirect_url: `/chat/${roomId}`,
            data: {
              roomId: roomId,
              senderId: supabaseUserId,
              messageId: data.id,
              messageType: type,
              timestamp: new Date().toISOString()
            }
          };

          // Add target user (Firebase UID)
          notificationData.target_user_id = recipientFirebaseUid;

          // Also try to get email for email notification if available
          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('firebase_uid', recipientFirebaseUid)
            .maybeSingle();

          if (userData?.email) {
            notificationData.email = userData.email;
          }

          // Send push notification via OneSignal
          await notificationService.sendNotification(notificationData)
            .then(response => {
              console.log('Push notification sent:', response);
              
              // Also create in-app notification in the database
              if (response.success) {
                supabase
                  .from('in_app_notifications')
                  .insert([{
                    user_id: recipientFirebaseUid, // Firebase UID
                    title: notificationData.title,
                    message: notificationData.body,
                    type: 'chat',
                    data: notificationData.data,
                    is_read: false,
                    created_at: new Date().toISOString()
                  }])
                  .then(({ error }) => {
                    if (error) console.error('Error creating in-app notification:', error);
                  });
              }
            })
            .catch(err => console.error('Failed to send push notification:', err));
        } else {
          console.warn('Could not find Firebase UID for recipient:', otherParticipant.id);
        }
      }
      
      updateRoomStatus('online');
      setIsTyping(false);
      
      // Auto-scroll to bottom after sending if user is at bottom
      if (autoScrollRef.current) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      addNotification({
        type: 'error',
        message: 'Failed to send message',
        duration: 3000
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      sendMessage('text');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      updateRoomStatus('typing');
      setIsTyping(true);
    }
    
    if (typingTimeout) clearTimeout(typingTimeout);
    
    const timeout = setTimeout(() => {
      setIsTyping(false);
      updateRoomStatus('online');
    }, 2000);
    
    setTypingTimeout(timeout);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    handleTyping();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      sendMessage('image', base64, file.name, file.size);
    } catch (error) {
      console.error('Error uploading image:', error);
      addNotification({
        type: 'error',
        message: 'Failed to upload image',
        duration: 3000
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadingFile(true);

    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      sendMessage('file', base64, file.name, file.size);
    } catch (error) {
      console.error('Error uploading file:', error);
      addNotification({
        type: 'error',
        message: 'Failed to upload file',
        duration: 3000
      });
      setSelectedFile(null);
    } finally {
      setUploadingFile(false);
    }
  };

  const startRecording = async () => {
    try {
      updateRoomStatus('typing');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });

        sendMessage('voice', base64, `voice_${Date.now()}.webm`);
        
        stream.getTracks().forEach(track => track.stop());
        updateRoomStatus('online');
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      addNotification({
        type: 'error',
        message: 'Could not access microphone. Please check permissions.',
        duration: 3000
      });
      updateRoomStatus('online');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      setRecordingTime(0);
    }
  };

  const handleMessageClick = (message: Message, event: React.MouseEvent) => {
    if (isSelecting) {
      const isSelected = selectedMessages.some(msg => msg.id === message.id);
      if (isSelected) {
        setSelectedMessages(prev => prev.filter(msg => msg.id !== message.id));
      } else {
        setSelectedMessages(prev => [...prev, {
          id: message.id,
          sender_id: message.sender_id,
          message_text: message.message_text,
          message_type: message.message_type,
          media_url: message.media_url,
          file_name: message.file_name
        }]);
      }
    }
  };

  const handleMessageLongPress = (message: Message) => {
    setIsLongPressing(true);
    setLongPressTimer(setTimeout(() => {
      if (!isSelecting) {
        setIsSelecting(true);
        setSelectedMessages([{
          id: message.id,
          sender_id: message.sender_id,
          message_text: message.message_text,
          message_type: message.message_type,
          media_url: message.media_url,
          file_name: message.file_name
        }]);
      }
      setIsLongPressing(false);
    }, 500));
  };

  const handleMessageMouseDown = (message: Message) => {
    handleMessageLongPress(message);
  };

  const handleMessageMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setIsLongPressing(false);
  };

  const handleMessageTouchStart = (message: Message) => {
    handleMessageLongPress(message);
  };

  const handleMessageTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setIsLongPressing(false);
  };

  const handleMessageDoubleClick = (message: Message) => {
    if (!isSelecting) {
      setIsSelecting(true);
      setSelectedMessages([{
        id: message.id,
        sender_id: message.sender_id,
        message_text: message.message_text,
        message_type: message.message_type,
        media_url: message.media_url,
        file_name: message.file_name
      }]);
    }
  };

  const handleCopyMessages = async () => {
    if (selectedMessages.length === 0) return;
    
    try {
      const textToCopy = selectedMessages.map(msg => {
        if (msg.message_type === 'image') return '[Image]';
        if (msg.message_type === 'voice') return '[Voice message]';
        if (msg.message_type === 'file') return `[File: ${msg.file_name}]`;
        return msg.message_text;
      }).join('\n');
      
      await navigator.clipboard.writeText(textToCopy);
      addNotification({
        type: 'success',
        message: `Copied ${selectedMessages.length} message(s) to clipboard`,
        duration: 2000
      });
      clearSelection();
    } catch (error) {
      console.error('Error copying messages:', error);
      addNotification({
        type: 'error',
        message: 'Failed to copy messages',
        duration: 3000
      });
    }
  };

  const handleDeleteMessages = async () => {
    if (selectedMessages.length === 0) return;
    
    const myMessageIds = selectedMessages
      .filter(msg => msg.sender_id === supabaseUserId)
      .map(msg => msg.id);
    
    if (myMessageIds.length === 0) {
      addNotification({
        type: 'warning',
        message: 'You can only delete your own messages',
        duration: 3000
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .in('id', myMessageIds);
      
      if (error) throw error;
      
      setMessages(prev => prev.filter(msg => !myMessageIds.includes(msg.id)));
      
      addNotification({
        type: 'success',
        message: `Deleted ${myMessageIds.length} message(s)`,
        duration: 2000
      });
      
      clearSelection();
    } catch (error) {
      console.error('Error deleting messages:', error);
      addNotification({
        type: 'error',
        message: 'Failed to delete messages',
        duration: 3000
      });
    }
  };

  const handleShareMessages = async () => {
    if (selectedMessages.length === 0) return;
    
    try {
      const shareText = selectedMessages.map(msg => {
        if (msg.message_type === 'image') return '[Image]';
        if (msg.message_type === 'voice') return '[Voice message]';
        if (msg.message_type === 'file') return `[File: ${msg.file_name}]`;
        return msg.message_text;
      }).join('\n\n');
      
      await navigator.clipboard.writeText(shareText);
      
      if (navigator.share) {
        await navigator.share({
          title: 'Messages from chat',
          text: shareText,
          url: window.location.href
        });
        addNotification({
          type: 'success',
          message: 'Messages shared successfully',
          duration: 2000
        });
      } else {
        addNotification({
          type: 'success',
          message: 'Messages copied! You can now paste them anywhere.',
          duration: 2000
        });
      }
      
      clearSelection();
    } catch (error) {
      console.error('Error sharing messages:', error);
      addNotification({
        type: 'error',
        message: 'Failed to share messages',
        duration: 3000
      });
    }
  };

  const handleReplyToMessage = () => {
    if (selectedMessages.length === 0) return;
    
    const messageToReply = selectedMessages[selectedMessages.length - 1];
    setReplyToMessage(messageToReply);
    clearSelection();
    
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  const clearSelection = () => {
    setSelectedMessages([]);
    setIsSelecting(false);
  };

 

  const answerCall = async () => {
    setCallStatus('connected');
    stopCallSound();
    
    if (callTimerRef.current) {
      clearTimeout(callTimerRef.current);
    }
    
    addNotification({
      type: 'success',
      message: 'Call connected',
      duration: 2000
    });
  };

  const endCall = () => {
    setActiveCall(null);
    setCallStatus('ended');
    stopCallSound();
    
    if (callTimerRef.current) {
      clearTimeout(callTimerRef.current);
      callTimerRef.current = null;
    }
    
    if (roomId) {
      supabase
        .from('calls')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('status', 'ringing')
        .then(({ error }) => {
          if (error) console.error('Error updating call:', error);
        });
    }
  };

  const handleBlockUser = async () => {
    if (!otherParticipant || !supabaseUserId) return;
    
    try {
      const { error } = await supabase
        .from('blocks')
        .insert([{
          blocker_id: supabaseUserId,
          blocked_id: otherParticipant.id,
          created_at: new Date().toISOString()
        }]);
      
      if (error) throw error;
      
      addNotification({
        type: 'success',
        message: `${otherParticipant.name} has been blocked`,
        duration: 3000
      });
      
      setTimeout(() => {
        navigate('/chats');
      }, 1500);
    } catch (error) {
      console.error('Error blocking user:', error);
      addNotification({
        type: 'error',
        message: 'Failed to block user',
        duration: 3000
      });
    }
  };

  const handleReportUser = async () => {
    if (!otherParticipant || !supabaseUserId) return;
    
    addNotification({
      type: 'info',
      message: 'Report feature would open a form in production',
      duration: 3000
    });
  };

  const loadEmojis = async () => {
    try {
      const { data, error } = await supabase
        .from('emojis')
        .select('*')
        .order('category')
        .order('name');

      if (error) throw error;
      
      if (data && data.length > 0) {
        setEmojis(data);
        setFilteredEmojis(data);
      } else {
        loadDefaultEmojis();
      }
    } catch (error) {
      console.error('Error loading emojis:', error);
      loadDefaultEmojis();
    }
  };

  const loadDefaultEmojis = () => {
    const defaultEmojis: Emoji[] = [
      { id: '1', emoji: '😀', category: 'smileys', name: 'grinning face', keywords: ['happy', 'joy', 'smile'] },
      { id: '2', emoji: '😂', category: 'smileys', name: 'face with tears of joy', keywords: ['funny', 'laugh', 'hilarious'] },
      { id: '3', emoji: '❤️', category: 'symbols', name: 'red heart', keywords: ['love', 'heart'] },
      { id: '4', emoji: '👍', category: 'gestures', name: 'thumbs up', keywords: ['good', 'yes'] },
      { id: '5', emoji: '🙏', category: 'gestures', name: 'folded hands', keywords: ['pray', 'thanks'] },
    ];
    setEmojis(defaultEmojis);
    setFilteredEmojis(defaultEmojis);
  };

  useEffect(() => {
    if (!emojiSearch.trim()) {
      setFilteredEmojis(emojis);
    } else {
      const searchTerm = emojiSearch.toLowerCase();
      const filtered = emojis.filter(emoji => 
        emoji.name.toLowerCase().includes(searchTerm) ||
        emoji.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm))
      );
      setFilteredEmojis(filtered);
    }
  }, [emojiSearch, emojis]);

  const insertEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    if (inputRef.current) {
      inputRef.current.focus();
    }
    handleTyping();
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = parseISO(timestamp);
      return format(date, 'h:mm a');
    } catch {
      return '';
    }
  };

  const formatDate = (timestamp: string) => {
    try {
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
    } catch {
      return '';
    }
  };

  const getStatusText = () => {
    if (!roomDetails || !supabaseUserId) return 'offline';
    
    const isParticipantA = roomDetails.p_a === supabaseUserId;
    const otherStatus = isParticipantA ? roomDetails.status_b : roomDetails.status_a;
    
    if (otherStatus === 'typing') {
      return 'typing...';
    } else if (otherStatus === 'online') {
      return 'online';
    } else if (onlineStatus.last_seen) {
      try {
        const date = parseISO(onlineStatus.last_seen);
        if (isValid(date)) {
          return `last seen ${formatDistanceToNow(date)} ago`;
        }
      } catch (error) {
        console.error('Error formatting last seen:', error);
      }
    }
    return 'offline';
  };

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle scroll position
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
    
    autoScrollRef.current = isAtBottom;
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (!loading && messages.length > 0 && autoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const supabaseId = await getSupabaseUserId(currentUser.uid);
          setSupabaseUserId(supabaseId);
          if (roomDetails) {
            updateRoomStatus('online');
          }
        } catch (error) {
          console.error('Auth error:', error);
          navigate('/');
        }
      } else {
        navigate('/');
      }
    });

    return () => unsubscribe();
  }, [navigate, roomDetails]);

  useEffect(() => {
    if (roomId && supabaseUserId) {
      fetchRoomDetails(supabaseUserId);
      fetchMessages();
      loadEmojis();
      
      const messagesChannel = supabase
        .channel(`room_messages:${roomId}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `room_id=eq.${roomId}`
          }, 
          (payload) => {
            const newMessage = payload.new as Message;
            
            // Convert Set to Array for iteration
            const sentMessageIdsArray = Array.from(sentMessageIds);
            if (!sentMessageIdsArray.includes(newMessage.id)) {
              setMessages(prev => {
                if (prev.some(msg => msg.id === newMessage.id)) {
                  return prev;
                }
                return [...prev, newMessage];
              });
              
              if (newMessage.sender_id !== supabaseUserId) {
                playSound('received');
                markMessagesAsRead();
                
                // Auto-scroll for new received messages if user is at bottom
                if (autoScrollRef.current) {
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }
              }
            }
          }
        )
        .subscribe();

      const updatesChannel = supabase
        .channel(`message_updates:${roomId}`)
        .on('postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${roomId}`
          },
          (payload) => {
            const updatedMessage = payload.new as Message;
            
            setMessages(prev => prev.map(msg => 
              msg.id === updatedMessage.id ? updatedMessage : msg
            ));
          }
        )
        .subscribe();

      const roomChannel = supabase
        .channel(`room_updates:${roomId}`)
        .on('postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`
          },
          (payload) => {
            const updatedRoom = payload.new as RoomDetails;
            setRoomDetails(updatedRoom);
          }
        )
        .subscribe();

      const callChannel = supabase
        .channel(`calls:${roomId}`)
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'calls',
            filter: `room_id=eq.${roomId}`
          },
          (payload) => {
            const call = payload.new as any;
            if (call.receiver_id === supabaseUserId && call.status === 'ringing') {
              setActiveCall(call.call_type);
              setCallStatus('ringing');
              setShowCallOptions(false);
              playSound('call');
            }
          }
        )
        .subscribe();

      // Clean up old status
      const cleanupOldStatus = () => {
        if (roomDetails && supabaseUserId) {
          const isParticipantA = roomDetails.p_a === supabaseUserId;
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          
          if (roomDetails.updated_at && roomDetails.updated_at < fiveMinutesAgo) {
            updateRoomStatus('offline');
          }
        }
      };

      onlineStatusRef.current = setInterval(() => {
        if (otherParticipant?.id) {
          supabase
            .from('users')
            .select('is_active, last_seen')
            .eq('id', otherParticipant.id)
            .single()
            .then(({ data }) => {
              if (data) {
                setOnlineStatus({
                  is_online: data.is_active || false,
                  last_seen: data.last_seen || new Date().toISOString()
                });
              }
            });
        }
        cleanupOldStatus();
      }, 30000);

      return () => {
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(updatesChannel);
        supabase.removeChannel(roomChannel);
        supabase.removeChannel(callChannel);
        if (onlineStatusRef.current) {
          clearInterval(onlineStatusRef.current);
        }
        if (roomDetails && supabaseUserId) {
          updateRoomStatus('offline');
        }
      };
    }
  }, [roomId, supabaseUserId, otherParticipant?.id, sentMessageIds, roomDetails]);

  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [typingTimeout]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (roomDetails && supabaseUserId) {
        updateRoomStatus('offline');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
      }
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
      if (callTimerRef.current) {
        clearTimeout(callTimerRef.current);
      }
      if (onlineStatusRef.current) {
        clearInterval(onlineStatusRef.current);
      }
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [mediaRecorder, isRecording, longPressTimer, typingTimeout, roomDetails, supabaseUserId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isSelecting && !event.defaultPrevented) {
        const target = event.target as HTMLElement;
        if (!target.closest('.chatroom-message') && !target.closest('.chatroom-header-action')) {
          clearSelection();
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isSelecting]);

  if (loading && messages.length === 0) {
    return (
      <div className="chatroom-loading">
        <div className="chatroom-spinner"></div>
        <p>Loading chat...</p>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate();

  return (
    <div className="chatroom-container">
      <div className="chatroom-notifications">
        {notifications.map((notification) => (
          <div 
            key={notification.id} 
            className={`chatroom-notification chatroom-notification-${notification.type}`}
          >
            <div className="chatroom-notification-content">
              {notification.type === 'success' && <Check size={14} />}
              {notification.type === 'error' && <AlertCircle size={14} />}
              {notification.type === 'warning' && <AlertCircle size={14} />}
              {notification.type === 'info' && <Info size={14} />}
              <span>{notification.message}</span>
            </div>
            <button 
              className="chatroom-notification-close"
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="chatroom-audio-toggle">
        <button 
          className={`chatroom-audio-btn ${audioEnabled ? 'enabled' : 'disabled'}`}
          onClick={() => setAudioEnabled(!audioEnabled)}
          title={audioEnabled ? "Mute sounds" : "Enable sounds"}
        >
          {audioEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
        </button>
      </div>

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
              {getStatusText() === 'online' && (
                <div className="chatroom-online"></div>
              )}
            </div>
            
            <div className="chatroom-userdetails">
              <h2 className="chatroom-username">
                {otherParticipant?.shop_name || otherParticipant?.name || 'Unknown'}
              </h2>
              <p className="chatroom-userstatus">
                {getStatusText()}
              </p>
            </div>
          </div>
        </div>

        <div className="chatroom-header-right">
          {isSelecting ? (
            <>
              <div className="chatroom-selection-count">
                {selectedMessages.length} selected
              </div>
              <button 
                className="chatroom-header-action"
                onClick={handleCopyMessages}
                title="Copy"
              >
                <Copy size={14} />
              </button>
              <button 
                className="chatroom-header-action"
                onClick={handleDeleteMessages}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
              <button 
                className="chatroom-header-action"
                onClick={handleShareMessages}
                title="Share"
              >
                <Share2 size={14} />
              </button>
              <button 
                className="chatroom-header-action"
                onClick={handleReplyToMessage}
                title="Reply"
              >
                <CornerUpLeft size={14} />
              </button>
              <button 
                className="chatroom-header-action chatroom-header-action-cancel"
                onClick={clearSelection}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>



{callStatus === 'idle' && (
  <>
    {/* Voice Call Button */}
    <button 
      className="chatroom-header-btn"
      onClick={async () => {
        const btn = document.getElementById('voice-call-btn');
        if (btn) btn.classList.add('loading');
        
        try {
          const otherId = roomDetails?.p_a === supabaseUserId 
            ? roomDetails?.p_b 
            : roomDetails?.p_a;
          
          if (!otherId) {
            addNotification({ type: 'error', message: 'Cannot identify other participant' });
            if (btn) btn.classList.remove('loading');
            return;
          }

          const firebaseUid = await getParticipantFirebaseUid(otherId);
          
          if (!firebaseUid) {
            addNotification({ type: 'error', message: 'Cannot start call: User ID not available' });
            if (btn) btn.classList.remove('loading');
            return;
          }

          navigate(`/call/${firebaseUid}`);
          
        } catch (error) {
          addNotification({ type: 'error', message: 'Failed to start call' });
          if (btn) btn.classList.remove('loading');
        }
      }}
      title="Voice Call"
      id="voice-call-btn"
    >
      <Phone size={14} />
      <span className="chatroom-btn-loader"></span>
    </button>
    
    {/* Video Call Button */}
    <button 
      className="chatroom-header-btn"
      onClick={async () => {
        const btn = document.getElementById('video-call-btn');
        if (btn) btn.classList.add('loading');
        
        try {
          const otherId = roomDetails?.p_a === supabaseUserId 
            ? roomDetails?.p_b 
            : roomDetails?.p_a;
          
          if (!otherId) {
            addNotification({ type: 'error', message: 'Cannot identify other participant' });
            if (btn) btn.classList.remove('loading');
            return;
          }

          const firebaseUid = await getParticipantFirebaseUid(otherId);
          
          if (!firebaseUid) {
            addNotification({ type: 'error', message: 'Cannot start call: User ID not available' });
            if (btn) btn.classList.remove('loading');
            return;
          }

          navigate(`/call/${firebaseUid}`);
          
        } catch (error) {
          addNotification({ type: 'error', message: 'Failed to start video call' });
          if (btn) btn.classList.remove('loading');
        }
      }}
      title="Video Call"
      id="video-call-btn"
    >
      <Video size={14} />
      <span className="chatroom-btn-loader"></span>
    </button>
  </>
)}


              
              {callStatus === 'ringing' && activeCall && (
                <>
                  {activeCall === 'voice' ? (
                    <button 
                      className="chatroom-header-btn chatroom-header-btn-success"
                      onClick={answerCall}
                      title="Answer Voice Call"
                    >
                      <Phone size={14} />
                    </button>
                  ) : (
                    <button 
                      className="chatroom-header-btn chatroom-header-btn-success"
                      onClick={answerCall}
                      title="Answer Video Call"
                    >
                      <Video size={14} />
                    </button>
                  )}
                  <button 
                    className="chatroom-header-btn chatroom-header-btn-danger"
                    onClick={endCall}
                    title="Decline Call"
                  >
                    <Phone size={14} style={{ transform: 'rotate(135deg)' }} />
                  </button>
                </>
              )}
              
              {callStatus === 'connected' && activeCall && (
                <>
                  <div className="chatroom-call-timer">
                    Call in progress...
                  </div>
                  <button 
                    className="chatroom-header-btn chatroom-header-btn-danger"
                    onClick={endCall}
                    title="End Call"
                  >
                    {activeCall === 'voice' ? (
                      <Phone size={14} style={{ transform: 'rotate(135deg)' }} />
                    ) : (
                      <VideoOff size={14} />
                    )}
                  </button>
                </>
              )}
              
              <button 
                className="chatroom-header-btn" 
                title="Info"
                onClick={() => setShowInfoPanel(!showInfoPanel)}
              >
                <Info size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {replyToMessage && (
        <div className="chatroom-reply-preview">
          <div className="chatroom-reply-preview-content">
            <div className="chatroom-reply-preview-header">
              <span className="chatroom-reply-preview-sender">
                {replyToMessage.sender_id === supabaseUserId ? 'You' : otherParticipant?.name}
              </span>
              <span className="chatroom-reply-preview-type">
                {replyToMessage.message_type === 'image' ? '[Image]' : 
                 replyToMessage.message_type === 'voice' ? '[Voice]' : 
                 replyToMessage.message_type === 'file' ? '[File]' : 'Text'}
              </span>
            </div>
            <div className="chatroom-reply-preview-message">
              {replyToMessage.message_type === 'text' 
                ? replyToMessage.message_text
                : replyToMessage.message_type === 'image' ? '[Image]' 
                : replyToMessage.message_type === 'voice' ? '[Voice message]'
                : `[File: ${replyToMessage.file_name}]`}
            </div>
          </div>
          <button 
            className="chatroom-reply-preview-cancel"
            onClick={handleCancelReply}
            title="Cancel reply"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div 
        className="chatroom-messages" 
        ref={messagesContainerRef}
        onClick={(e) => {
          if (isSelecting && e.target === e.currentTarget) {
            clearSelection();
          }
        }}
      >
        {Object.entries(messageGroups).map(([date, dateMessages]) => (
          <div key={date} className="chatroom-date-group">
            <div className="chatroom-date">
              <span>{date}</span>
            </div>
            
            {dateMessages.map((message) => {
              const isOwnMessage = message.sender_id === supabaseUserId;
              const isSelected = selectedMessages.some(msg => msg.id === message.id);
              
              return (
                <div 
                  key={message.id} 
                  className={`chatroom-message ${isOwnMessage ? 'own' : 'other'} ${isSelected ? 'selected' : ''}`}
                  onClick={(e) => handleMessageClick(message, e)}
                  onDoubleClick={() => handleMessageDoubleClick(message)}
                  onMouseDown={() => handleMessageMouseDown(message)}
                  onMouseUp={handleMessageMouseUp}
                  onMouseLeave={handleMessageMouseUp}
                  onTouchStart={() => handleMessageTouchStart(message)}
                  onTouchEnd={handleMessageTouchEnd}
                  onTouchCancel={handleMessageTouchEnd}
                >
                  {!isOwnMessage && otherParticipant?.avatar_url && (
                    <div className="chatroom-message-avatar">
                      <img 
                        src={otherParticipant.avatar_url} 
                        alt={otherParticipant.name}
                      />
                    </div>
                  )}
                  
                  <div className={`chatroom-bubble ${isOwnMessage ? 'own' : 'other'}`}>
                    {message.metadata?.reply_to && (
                      <div className="chatroom-reply-indicator">
                        <div className="chatroom-reply-indicator-line"></div>
                        <div className="chatroom-reply-indicator-content">
                          <span className="chatroom-reply-indicator-sender">
                            {message.metadata.reply_to.sender_id === supabaseUserId ? 'You' : otherParticipant?.name}
                          </span>
                          <span className="chatroom-reply-indicator-text">
                            {message.metadata.reply_to.message_text}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {message.message_type === 'image' && message.media_url && (
                      <div className="chatroom-image">
                        <img 
                          src={message.media_url} 
                          alt="Shared image"
                          onClick={() => window.open(message.media_url, '_blank')}
                        />
                      </div>
                    )}
                    
                    {message.message_type === 'voice' && message.media_url && (
                      <div className="chatroom-voice">
                        <button 
                          className="chatroom-voice-play"
                          onClick={() => {
                            const audio = new Audio(message.media_url);
                            audio.play();
                          }}
                        >
                          <Volume2 size={12} />
                        </button>
                        <div className="chatroom-voice-wave">
                          <div className="chatroom-voice-bar"></div>
                          <div className="chatroom-voice-bar"></div>
                          <div className="chatroom-voice-bar"></div>
                          <div className="chatroom-voice-bar"></div>
                          <div className="chatroom-voice-bar"></div>
                        </div>
                        <span className="chatroom-voice-time">0:{Math.floor(Math.random() * 30) + 10}</span>
                      </div>
                    )}

                    {message.message_type === 'file' && (
                      <div className="chatroom-file">
                        <div className="chatroom-file-icon">
                          <File size={20} />
                        </div>
                        <div className="chatroom-file-info">
                          <div className="chatroom-file-name">
                            {message.file_name || 'Unknown file'}
                          </div>
                          {message.file_size && (
                            <div className="chatroom-file-size">
                              {formatFileSize(message.file_size)}
                            </div>
                          )}
                        </div>
                        {message.media_url && (
                          <a 
                            href={message.media_url} 
                            download={message.file_name}
                            className="chatroom-file-download"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    )}
                    
                    {message.message_text && (
                      <p className="chatroom-text">{message.message_text}</p>
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
                    </div>
                  </div>
                  
                  {isSelecting && (
                    <div className="chatroom-message-checkbox">
                      <div className={`chatroom-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected && <Check size={10} />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {selectedFile && (
        <div className="chatroom-file-preview">
          <div className="chatroom-file-preview-content">
            <File size={16} />
            <span className="chatroom-file-preview-name">
              {selectedFile.name}
            </span>
            <span className="chatroom-file-preview-size">
              {formatFileSize(selectedFile.size)}
            </span>
            <button 
              className="chatroom-file-preview-cancel"
              onClick={() => setSelectedFile(null)}
              disabled={uploadingFile}
            >
              <XCircle size={16} />
            </button>
          </div>
        </div>
      )}

      {showEmojiPicker && (
        <div className="chatroom-emoji-picker" ref={emojiPickerRef}>
          <div className="chatroom-emoji-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search emojis..."
              value={emojiSearch}
              onChange={(e) => setEmojiSearch(e.target.value)}
              className="chatroom-emoji-search-input"
            />
            {emojiSearch && (
              <button 
                className="chatroom-emoji-search-clear"
                onClick={() => setEmojiSearch("")}
              >
                <X size={12} />
              </button>
            )}
          </div>
          
          <div className="chatroom-emoji-grid">
            {filteredEmojis.map((emoji) => (
              <button
                key={emoji.id}
                className="chatroom-emoji-btn"
                onClick={() => insertEmoji(emoji.emoji)}
                title={emoji.name}
              >
                {emoji.emoji}
              </button>
            ))}
          </div>
          
          <div className="chatroom-emoji-footer">
            <button 
              className="chatroom-emoji-close"
              onClick={() => setShowEmojiPicker(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="chatroom-input">
        <div className="chatroom-input-left">
          <button 
            className="chatroom-input-btn"
            onClick={() => document.getElementById('chatroom-image-upload')?.click()}
            title="Image"
          >
            <ImageIcon size={14} />
          </button>
          
          <input
            type="file"
            id="chatroom-image-upload"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          
          <button 
            className="chatroom-input-btn"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Emoji"
          >
            <Smile size={14} />
          </button>
          
          <button 
            className={`chatroom-input-btn ${isRecording ? 'recording' : ''}`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            title="Hold to record"
          >
            <Mic size={14} />
          </button>
          
          <button 
            className="chatroom-input-btn"
            onClick={() => fileInputRef.current?.click()}
            title="File"
            disabled={uploadingFile}
          >
            <Paperclip size={14} />
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
          />
          
          {isRecording && (
            <div className="chatroom-recording">
              <div className="chatroom-recording-dot"></div>
              <span className="chatroom-recording-time">{recordingTime}s</span>
              <span className="chatroom-recording-text">Release to send</span>
            </div>
          )}
        </div>
        
        <div className="chatroom-input-center">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="chatroom-input-field"
            disabled={sending}
          />
        </div>
        
        <div className="chatroom-input-right">
          {newMessage.trim() || selectedFile ? (
            <button 
              className="chatroom-send"
              onClick={handleSendMessage}
              disabled={sending || uploadingFile}
            >
              {sending || uploadingFile ? (
                <div className="chatroom-send-spinner"></div>
              ) : (
                <Send size={12} />
              )}
            </button>
          ) : (
            <button 
              className="chatroom-input-btn" 
              title="More options"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile size={14} />
            </button>
          )}
        </div>
      </div>

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
                    <img src={otherParticipant.avatar_url} alt={otherParticipant.name} />
                  ) : (
                    <div className="chatroom-info-pic-placeholder">
                      {otherParticipant?.user_type === 'vendor' ? <Store size={10} /> : <User size={10} />}
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
                  <span className="chatroom-info-status">
                    {getStatusText()}
                  </span>
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
            
            <div className="chatroom-info-section">
              <h4>Details</h4>
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
            
            <div className="chatroom-info-actions">
              <button 
                className="chatroom-info-btn"
                onClick={handleBlockUser}
              >
                <Ban size={12} />
                <span>Block</span>
              </button>
              <button 
                className="chatroom-info-btn chatroom-info-btn-danger"
                onClick={handleReportUser}
              >
                <Flag size={12} />
                <span>Report</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}