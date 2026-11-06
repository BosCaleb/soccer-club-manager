// Deliberately contains no resource declarations: P0 must not incur Azure costs.
targetScope = 'resourceGroup'
@allowed(['southafricanorth'])
param location string = 'southafricanorth'
output applicationLocation string = location
output backupsConfigured bool = false
output centralLoggingConfigured bool = false
