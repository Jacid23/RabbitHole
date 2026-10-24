# Chat history

The entrance lists the account's saved conversations across accessible holes. Opening a conversation enters its original hole. Inside a hole, **Your visits** and the sidebar show that hole's saved conversations. Continuing a chat moves it to the top of recent history.

**New chat** saves messages to the account. **Temporary chat** holds its context in the open browser view and sends it with each turn without creating Rabbit Hole history records. Leaving it through app navigation asks whether to stay or discard it. Refreshing or closing clears it. Connected model services may have their own logging policies; this is not a promise about upstream retention.

Image creation remains a separate, explicit action and saves creations to the image library. Removing a chat does not remove library images.

**Lock** protects a saved conversation from deletion. It remains readable and can be continued. **Unlock** allows deletion again. Locks are enforced on the server and survive reply updates.

**Delete** moves an unlocked conversation into the account's recoverable **Trash**, available in entrance history and **Your visits**. **Restore** returns its messages and original hole assignment. **Delete forever** erases an individual trashed chat. **Empty Trash** erases the Trash shown in the current history view: all accessible holes at the entrance, or only the selected hole in Your visits. Both require an explicit in-app confirmation. Newly trashed conversations after confirmation was opened are excluded. This removes stored Rabbit Hole chat records; existing backups and separate image-library items are unchanged.

History, locks, trash, and restoration are account-scoped and recheck current hole permissions. Temporary chats have no history entry to lock or delete.
