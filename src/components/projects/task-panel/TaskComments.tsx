import { useState } from "react";
import { useTaskComments, useCreateComment, useDeleteComment } from "@/hooks/projects/use-task-comments";
import { useProjectMembers } from "@/hooks/projects/use-project-members";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Send, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface TaskCommentsProps {
  taskId: string;
  projectId: string;
}

export function TaskComments({ taskId, projectId }: TaskCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const { user } = useAuth();
  const { data: comments, isLoading } = useTaskComments(taskId);
  const { members } = useProjectMembers(projectId);
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  
  const handleSubmit = () => {
    if (!newComment.trim()) return;
    
    // Parse @mentions from comment
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(newComment)) !== null) {
      mentions.push(match[2]);
    }
    
    createComment.mutate({
      task_id: taskId,
      content: newComment.trim(),
      mentions: mentions.length > 0 ? mentions : undefined,
    });
    setNewComment("");
  };
  
  const handleDelete = (id: string) => {
    deleteComment.mutate({ id, task_id: taskId });
  };
  
  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Comments</h4>
      
      {/* Comment list */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {comments?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No comments yet
          </p>
        )}
        {comments?.map((comment) => (
          <div key={comment.id} className="flex gap-3 group">
            <Avatar className="h-8 w-8">
              <AvatarImage src={comment.user?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {getInitials(comment.user?.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {comment.user?.display_name || 'Unknown'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
                {user?.id === comment.user_id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 ml-auto"
                    onClick={() => handleDelete(comment.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {/* New comment input */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[60px] text-sm resize-none"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!newComment.trim() || createComment.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
