
import { ChatState, ChatAction } from './types';

const initialState: ChatState = {
  rooms: {},
  messages: {},
  onlineUsers: {},
  activeRoomId: null,
  currentView: 'rooms',
  loading: {
    rooms: false,
    messages: {},
    sending: false,
    loadingMore: {},
  },
  pagination: {},
  connection: {
    status: 'disconnected',
    retryCount: 0,
  },
  errors: {},
  cache: {
    lastFetch: {},
    invalidated: new Set(),
  },
};

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_LOADING': {
      const { key, value } = action.payload;
      if (typeof key === 'string' && key.includes('.')) {
        const [category, subKey] = key.split('.');
        const currentCategory = state.loading[category as keyof typeof state.loading];
        
        if (typeof currentCategory === 'object' && currentCategory !== null) {
          return {
            ...state,
            loading: {
              ...state.loading,
              [category]: {
                ...currentCategory,
                [subKey]: value,
              },
            },
          };
        }
      }
      return {
        ...state,
        loading: {
          ...state.loading,
          [key]: value,
        },
      };
    }

    case 'SET_ROOMS':
      return {
        ...state,
        rooms: action.payload.reduce((acc, room) => {
          acc[room.id] = room;
          return acc;
        }, {} as Record<string, any>),
      };

    case 'ADD_ROOM':
      return {
        ...state,
        rooms: {
          ...state.rooms,
          [action.payload.id]: action.payload,
        },
      };

    case 'UPDATE_ROOM':
      return {
        ...state,
        rooms: {
          ...state.rooms,
          [action.payload.roomId]: {
            ...state.rooms[action.payload.roomId],
            ...action.payload.updates,
          },
        },
      };

    case 'SET_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.roomId]: action.payload.messages,
        },
        pagination: {
          ...state.pagination,
          [action.payload.roomId]: {
            hasMore: action.payload.hasMore,
            nextCursor: action.payload.nextCursor,
            totalLoaded: action.payload.messages.length,
          },
        },
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.roomId]: [
            ...(state.messages[action.payload.roomId] || []),
            action.payload.message,
          ],
        },
      };

    case 'PREPEND_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.roomId]: [
            ...action.payload.messages,
            ...(state.messages[action.payload.roomId] || []),
          ],
        },
        pagination: {
          ...state.pagination,
          [action.payload.roomId]: {
            hasMore: action.payload.hasMore,
            nextCursor: action.payload.nextCursor,
            totalLoaded: (state.pagination[action.payload.roomId]?.totalLoaded || 0) + action.payload.messages.length,
          },
        },
      };

    case 'SET_ONLINE_USERS':
      return {
        ...state,
        onlineUsers: action.payload.reduce((acc, user) => {
          acc[user.user_id] = user;
          return acc;
        }, {} as Record<string, any>),
      };

    case 'UPDATE_USER_PRESENCE':
      return {
        ...state,
        onlineUsers: {
          ...state.onlineUsers,
          [action.payload.user_id]: action.payload,
        },
      };

    case 'SET_ACTIVE_ROOM':
      return {
        ...state,
        activeRoomId: action.payload,
      };

    case 'SET_CURRENT_VIEW':
      return {
        ...state,
        currentView: action.payload,
      };

    case 'SET_CONNECTION_STATE':
      return {
        ...state,
        connection: {
          ...state.connection,
          ...action.payload,
        },
      };

    case 'SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.key]: action.payload.error,
        },
      };

    case 'CLEAR_ERROR':
      const newErrors = { ...state.errors };
      delete newErrors[action.payload];
      return {
        ...state,
        errors: newErrors,
      };

    case 'INVALIDATE_CACHE':
      return {
        ...state,
        cache: {
          ...state.cache,
          invalidated: new Set([...state.cache.invalidated, ...action.payload]),
        },
      };

    case 'CLEAR_ALL_CACHE':
      return {
        ...state,
        cache: {
          lastFetch: {},
          invalidated: new Set(),
        },
        messages: {},
        pagination: {},
      };

    case 'MARK_MESSAGE_READ': {
      const { messageId, userId } = action.payload;
      const updatedMessages = { ...state.messages };
      
      for (const roomId in updatedMessages) {
        updatedMessages[roomId] = updatedMessages[roomId].map(message => {
          if (message.id === messageId && !message.read_by.includes(userId)) {
            return {
              ...message,
              read_by: [...message.read_by, userId],
            };
          }
          return message;
        });
      }
      
      return {
        ...state,
        messages: updatedMessages,
      };
    }

    default:
      return state;
  }
}

export { initialState };
