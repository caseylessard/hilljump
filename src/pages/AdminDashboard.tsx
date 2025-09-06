import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DividendDataImport } from '@/components/admin/DividendDataImport';
import { ManualDividendEntry } from '@/components/admin/ManualDividendEntry';
import { DividendDataMonitor } from '@/components/admin/DividendDataMonitor';
import { Settings, Database, Monitor, Plus } from 'lucide-react';

export const AdminDashboard = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage dividend data and system health</p>
        </div>
      </div>

      <Tabs defaultValue="monitor" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monitor" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Monitor
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Manual Entry
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Bulk Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitor">
          <DividendDataMonitor />
        </TabsContent>

        <TabsContent value="manual">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Fix for Missing Distributions</CardTitle>
                <CardDescription>
                  When automated systems lag behind, manually add missing dividend distributions here.
                  This is especially useful for high-frequency distributors like YieldMax ETFs.
                </CardDescription>
              </CardHeader>
            </Card>
            <ManualDividendEntry />
          </div>
        </TabsContent>

        <TabsContent value="import">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bulk Data Import</CardTitle>
                <CardDescription>
                  Import large amounts of dividend data from CSV files. 
                  Use this for historical data imports or when switching data providers.
                </CardDescription>
              </CardHeader>
            </Card>
            <DividendDataImport />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};