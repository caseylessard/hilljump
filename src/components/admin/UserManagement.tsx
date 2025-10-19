import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Mail, AlertTriangle, Search, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserData {
  id: string;
  email: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  country: string;
  approved: boolean;
  created_at: string;
  roles: string[];
  subscription: {
    subscribed: boolean;
    tier: string | null;
  };
  post_count?: number;
  comment_count?: number;
  flag_count?: number;
}

export const UserManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('admin-get-users', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (response.error) throw response.error;
      
      setUsers(response.data.users || []);
    } catch (error: any) {
      toast({
        title: "Failed to load users",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (userId: string, role: 'admin' | 'subscriber' | 'premium', currentlyHas: boolean) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('admin-update-user-role', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        },
        body: {
          targetUserId: userId,
          role,
          action: currentlyHas ? 'remove' : 'add'
        }
      });

      if (response.error) throw response.error;

      // Update local state
      setUsers(users.map(u => {
        if (u.id === userId) {
          const newRoles = currentlyHas 
            ? u.roles.filter(r => r !== role)
            : [...u.roles, role];
          return { ...u, roles: newRoles };
        }
        return u;
      }));

      toast({
        title: "Role updated",
        description: `${role} role ${currentlyHas ? 'removed' : 'added'} successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleApproval = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approved: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(u => 
        u.id === userId ? { ...u, approved: !currentStatus } : u
      ));

      toast({
        title: "User status updated",
        description: `User ${!currentStatus ? 'approved' : 'unapproved'} successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const sendPasswordReset = async () => {
    if (!selectedUser?.email) return;
    
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      toast({
        title: "Password reset sent",
        description: `Reset link sent to ${selectedUser.email}`,
      });
      setShowResetDialog(false);
      setSelectedUser(null);
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Button variant="outline" size="sm" onClick={loadUsers}>
              Refresh
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-center">Posts</TableHead>
                  <TableHead className="text-center">Comments</TableHead>
                  <TableHead className="text-center">Flags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-sm">{user.email || 'No email'}</TableCell>
                    <TableCell>{user.username || '-'}</TableCell>
                    <TableCell>
                      {user.first_name || user.last_name
                        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {user.country === 'US' ? '🇺🇸 US' : '🇨🇦 CA'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{user.post_count || 0}</TableCell>
                    <TableCell className="text-center">{user.comment_count || 0}</TableCell>
                    <TableCell className="text-center">
                      {user.flag_count > 0 ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {user.flag_count}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.approved ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant={user.roles.includes('admin') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleRole(user.id, 'admin', user.roles.includes('admin'))}
                        >
                          Admin
                        </Button>
                        <Button
                          variant={user.roles.includes('subscriber') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleRole(user.id, 'subscriber', user.roles.includes('subscriber'))}
                        >
                          Subscriber
                        </Button>
                        <Button
                          variant={user.roles.includes('premium') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleRole(user.id, 'premium', user.roles.includes('premium'))}
                        >
                          Premium
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleApproval(user.id, user.approved)}
                        >
                          {user.approved ? 'Revoke' : 'Approve'}
                        </Button>
                        {user.email && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowResetDialog(true);
                            }}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching your search.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Password Reset</DialogTitle>
            <DialogDescription>
              Send a password reset email to {selectedUser?.email}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowResetDialog(false);
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={sendPasswordReset} disabled={resetting}>
              {resetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Reset Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};