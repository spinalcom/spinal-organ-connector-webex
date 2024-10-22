/*
 * Copyright 2021 SpinalCom - www.spinalcom.com
 *
 * This file is part of SpinalCore.
 *
 * Please read all of the following terms and conditions
 * of the Free Software license Agreement ("Agreement")
 * carefully.
 *
 * This Agreement is a legally binding contract between
 * the Licensee (as defined below) and SpinalCom that
 * sets forth the terms and conditions that govern your
 * use of the Program. By installing and/or using the
 * Program, you agree to abide by all the terms and
 * conditions stated or referenced herein.
 *
 * If you do not agree to abide by these terms and
 * conditions, do not demonstrate your acceptance and do
 * not install or use the Program.
 * You should have received a copy of the license along
 * with this file. If not, see
 * <http://resources.spinalcom.com/licenses.pdf>.
 */

import moment = require('moment');
import {
  SpinalContext,
  SpinalGraph,
  SpinalGraphService,
  SpinalNode,
  SpinalNodeRef,
  SPINAL_RELATION_PTR_LST_TYPE,
} from 'spinal-env-viewer-graph-service';

import type OrganConfigModel from '../../../model/OrganConfigModel';

import serviceDocumentation, { attributeService } from 'spinal-env-viewer-plugin-documentation-service';
import { NetworkService , SpinalBmsEndpoint} from 'spinal-model-bmsnetwork';
import {
  InputDataDevice,
  InputDataEndpoint,
  InputDataEndpointGroup,
  InputDataEndpointDataType,
  InputDataEndpointType,
} from '../../../model/InputData/InputDataModel/InputDataModel';
import { SpinalServiceTimeseries } from 'spinal-model-timeseries';
import { ClientApi } from '../../../services/client/ClientAuth';
import { IDeviceInfo } from '../../../interfaces/api/IDeviceInfo';
import { IDeviceMeasure } from '../../../interfaces/api/IDeviceMeasure';
import { IWorkspaceInfo } from '../../../interfaces/api/IWorkplaceListApiResponse';


type Capability =
  | 'soundLevel'
  | 'ambientNoise'
  | 'temperature'
  | 'relativeHumidity'
  | 'airQuality'
  | 'occupancyDetection'
  | 'presenceDetection';

type MetricName =
  | 'soundLevel'
  | 'ambientNoise'
  | 'temperature'
  | 'humidity'
  | 'tvoc'
  | 'peopleCount';


const capabilityToMetricMap: Record<Capability, MetricName> = {
  soundLevel: 'soundLevel',
  ambientNoise: 'ambientNoise',
  temperature: 'temperature',
  relativeHumidity: 'humidity',
  airQuality: 'tvoc',
  occupancyDetection: 'peopleCount',
  presenceDetection: 'peopleCount',
};

const allMetrics = [
  'soundLevel',
  'ambientNoise',
  'temperature',
  'humidity',
  'tvoc',
  'peopleCount',
]



/**
 * Main purpose of this class is to pull data from client.
 *
 * @export
 * @class SyncRunPull
 */
export class SyncRunPullApi {
  graph: SpinalGraph<any>;
  config: OrganConfigModel;
  interval: number;
  running: boolean;
  nwService: NetworkService;
  networkContext: SpinalNode<any>;
  timeseriesService: SpinalServiceTimeseries;
  private apiClient: ClientApi;
  private workplaceMetrics : any; 

  constructor(
    graph: SpinalGraph<any>,
    config: OrganConfigModel,
    nwService: NetworkService
  ) {
    this.graph = graph;
    this.config = config;
    this.running = false;
    this.nwService = nwService;
    this.timeseriesService = new SpinalServiceTimeseries();
    this.apiClient = ClientApi.getInstance();
    this.workplaceMetrics = {};
  }

  async getNetworkContext(): Promise<SpinalNode<any>> {
    const contexts = await this.graph.getChildren();
    for (const context of contexts) {
      if (context.info.name.get() === process.env.NETWORK_NAME) {
        // @ts-ignore
        SpinalGraphService._addNode(context);
        return context;
      }
    }
    throw new Error('Network Context Not found');
  }

  private waitFct(nb: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(
        () => {
          resolve();
        },
        nb >= 0 ? nb : 0
      );
    });
  }

  async createDevice(device : IWorkspaceInfo){
    const deviceNodeModel = new InputDataDevice(device.displayName, 'device'); 
      await this.nwService.updateData(deviceNodeModel);
      console.log('Created device ', device.displayName);
      
      //await this.modifyMaxDayAttribute();
  }

  dateToNumber(dateString: string | Date) {
    const dateObj = new Date(dateString);
    return dateObj.getTime();
  }
  async addEndpointAttributes(node :SpinalNode<any>, measure : IDeviceMeasure ){
    await attributeService.addAttributeByCategoryName(node,'GA','measure_code',measure.measure_code,'string')
  }

  async addDeviceAttributes(node :SpinalNode<any>, device : IWorkspaceInfo){
    await attributeService.createOrUpdateAttrsAndCategories(node, 'Webex', {
     'id': device.id,
     'orgId': device.orgId,
     'type': device.type,
     'devicePlatform': device.devicePlatform,
     'capacity': device.capacity ? device.capacity.toString() : ''
    });

    // await attributeService.addAttributeByCategoryName(node,'GA','device_id',`${deviceId}`,'number')
    // await attributeService.addAttributeByCategoryName(node,'GA','device_type',device.device_type,'string')
  }


  async getOrCreateEndpoint(deviceNode: SpinalNode<any>, data :any){
    const endpointNodes = await deviceNode.getChildren('hasBmsEndpoint');
    let endpointNode = endpointNodes.find((node) => node.info.name.get() === data.metricName);
    if(!endpointNode){
      // Create new endpoint
      // console.log('Endpoint do not exist, creating new endpoint... ', data.metricName);
      endpointNode = await this.createEndpoint(deviceNode, data);
    }
    SpinalGraphService._addNode(endpointNode);
    return endpointNode;
  }

  async createEndpoint(deviceNode: SpinalNode<any>, data :any) {
    const context = this.networkContext;
    const endpointNodeModel = new InputDataEndpoint(
      data.metricName ?? 'Unnamed',
      data.items[0].value,
      data.unit ?? '',
      InputDataEndpointDataType.Real,
      InputDataEndpointType.Other
    );
    const res = new SpinalBmsEndpoint(
      endpointNodeModel.name,
      endpointNodeModel.path,
      endpointNodeModel.currentValue,
      endpointNodeModel.unit,
      InputDataEndpointDataType[endpointNodeModel.dataType],
      InputDataEndpointType[endpointNodeModel.type],
      endpointNodeModel.id
    );
    const childId = SpinalGraphService.createNode(
      { type: SpinalBmsEndpoint.nodeTypeName, name: endpointNodeModel.name },
      res
    );
    await SpinalGraphService.addChildInContext(
      deviceNode.getId().get(),
      childId,
      context.getId().get(),
      SpinalBmsEndpoint.relationName,
      SPINAL_RELATION_PTR_LST_TYPE
    );

    const node  = SpinalGraphService.getRealNode(childId);
    //await this.addEndpointAttributes(node,measure);
    console.log('Created endpoint ', data.metricName, 'under device ', deviceNode.info.name.get());
    await serviceDocumentation.createOrUpdateAttrsAndCategories(node, 'default', 
      {
      'timeSeries maxDay' : '40', 
      'timeSeries initialBlockSize' : '50'
      })
    

    return node


  }


  async getOrCreateDeviceNode ( workplace : IWorkspaceInfo){
    let devices = await this.networkContext.findInContext(
      this.networkContext,
      (node) => node.info.name.get() === workplace.displayName
    );
    if (devices.length == 0) {
      console.log(
        'Device do not exist, creating new device... ',
        workplace.displayName
      );
      await this.createDevice(workplace);
      devices = await this.networkContext.findInContext(
        this.networkContext,
        (node) => node.info.name.get() === workplace.displayName
      );
      await this.addDeviceAttributes(devices[0],workplace)
    }
    SpinalGraphService._addNode(devices[0]);
    return devices[0];
  }
  
  async initDevices(){
    const workplaceList = (await this.apiClient.getWorkplaces()).items;
    for(const workplace of workplaceList){
      const deviceNode = await this.getOrCreateDeviceNode(workplace);

      /*const capabilities = (await this.apiClient.getWorkplaceCapabilities(workplace.id)).capabilities
      for(const capability of Object.keys(capabilities)){
        if(!capabilities[capability].supported || !capabilities[capability].configured) continue;
          if(!this.workplaceMetrics[workplace.displayName]){
            this.workplaceMetrics[workplace.displayName] = [];
          }
          if(!this.workplaceMetrics[workplace.displayName].includes(capabilityToMetricMap[capability as Capability])){
          this.workplaceMetrics[workplace.displayName].push(capabilityToMetricMap[capability as Capability]);
          }
      }
      for(const metric of allMetrics){
        if(!this.workplaceMetrics[workplace.displayName]){
          this.workplaceMetrics[workplace.displayName] = [];
        }
        if(!this.workplaceMetrics[workplace.displayName].includes(metric)){
          this.workplaceMetrics[workplace.displayName].push(metric);
        }
      }

      if(!this.workplaceMetrics[workplace.displayName]){
        continue
      }
      
      for(const metric of this.workplaceMetrics[workplace.displayName]){
        const data = await this.apiClient.getWorkplaceMetrics(workplace.id,metric,'none')
        if(!data.items) continue;
        const endpointNode = await this.getOrCreateEndpoint(deviceNode,data)
        await this.nwService.setEndpointValue(endpointNode.info.id.get(), data.items[0].value)
        await this.timeseriesService.insertFromEndpoint(endpointNode.info.id.get(), data.items[0].value, this.dateToNumber(data.items[0].timestamp))
      }*/

      for(const metric of allMetrics){
        const data = await this.apiClient.getWorkplaceMetrics(workplace.id,metric,'none')
        if(data.items.length === 0) continue;
        const endpointNode = await this.getOrCreateEndpoint(deviceNode,data)

        await this.nwService.setEndpointValue(endpointNode.info.id.get(), data.items[0].value)
        await this.timeseriesService.insertFromEndpoint(endpointNode.info.id.get(), data.items[0].value, this.dateToNumber(data.items[0].timestamp))
        console.log('Data update for ', metric, ' : ', data.items[0].value);
      }
      

    }
    //console.log(this.workplaceMetrics);

  }

  

  async init(): Promise<void> {
    console.log('Initiating SyncRunPull');
    this.networkContext = await this.getNetworkContext();

    try {
      
      await this.initDevices();

      //await this.updateEndpoints();
      this.config.lastSync.set(Date.now());
      console.log('Init DONE !')
    } catch (e) {
      console.error(e);
    }
  }

  async run(): Promise<void> {
    console.log("Starting run...")
    this.running = true;
    const timeout = parseInt(process.env.PULL_INTERVAL)
    await this.waitFct(timeout);
    while (true) {
      if (!this.running) break;
      const before = Date.now();
      try {
        console.log("Updating Data...");
        await this.initDevices();
        console.log("... Data Updated !")
        this.config.lastSync.set(Date.now());
      } catch (e) {
        console.error(e);
        await this.waitFct(1000 * 60);
      } finally {
        const delta = Date.now() - before;
        const timeout = parseInt(process.env.PULL_INTERVAL) - delta;
        await this.waitFct(timeout);
      }
    }
    
  }

  stop(): void {
    this.running = false;
  }
}
export default SyncRunPullApi;
