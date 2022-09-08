import express from 'express';
const router = express.Router();
import PilotOnline from '../models/PilotOnline.js';
import AtcOnline from '../models/AtcOnline.js';
import ControllerHours from '../models/ControllerHours.js';

const airports = {
	PHX: 'Phoenix', 
    ABQ: 'Albuquerque', 
    TUS: 'Tucson', 
    AMA: 'Amarillo', 
    ROW: 'Roswell', 
    ELP: 'El Paso', 
    SDL: 'Scottsdale', 
    CHD: 'Chandler', 
    FFZ: 'Falcon', 
    IWA: 'Gateway', 
    DVT: 'Deer Valley', 
    GEU: 'Glendale', 
    GYR: 'Goodyear', 
    LUF: 'Luke', 
    RYN: 'Ryan', 
    DMA: 'Davis-Monthan',
    FLG: 'Flagstaff', 
    PRC: 'Prescott', 
    AEG: 'Double Eagle', 
    BIF: 'Biggs', 
    HMN: 'Holoman', 
    SAF: 'Santa Fe',
    FHU: 'Libby'
};

const positions = {
	DEL: 'Delivery',
	GND: 'Ground',
	TWR: 'Tower',
	DEP: 'Departure',
	APP: 'Approach',
	CTR: 'Center'
};

const centerSector = {
  15: 'BGDLO',
  16: 'SANLO',
  17: 'LAVLO',
  19: 'DMNLO',
  20: 'SFLLO',
  21: 'CVSLO',
  23: 'ROWLH',
  37: 'HIPHI',
  38: 'MIALH',
  39: 'FOSLH',
  42: 'GBNLO',
  43: 'DRKLO',
  45: 'INWLO',
  46: 'TUSLO',
  47: 'SVCLO',
  49: 'TFDLO',
  50: 'PAYHI',
  58: 'BLKUH',
  63: 'ELPHI',
  65: 'PHXUH',
  67: 'INWHI',
  68: 'ABQHI',
  70: 'ESPHI',
  71: 'KENHI',
  72: 'CIMUH',
  75: 'FSTUH',
  78: 'OTOHI',
  79: 'CIEUH',
  80: 'TXOHI',
  87: 'SUNHI',
  89: 'SSOHI',
  90: 'GBNHI',
  91: 'PRCUH',
  92: 'GUPHI',
  93: 'CNXLH',
  94: 'LVSHI',
  96: 'TCCUH',
  97: 'AMAHI',
  98: 'DHTUH'
}

const p50Sector = {
  A: 'Apache',
  Q: 'Quartz',
  N: 'Navajo',
  S: 'Santan',
  F: 'Freeway',
  V: 'Verde',
  B: 'Biltmore',
  P: 'Pima',
  W: 'Willie',
  J: 'Jerome',
  K: 'Kachina',
  C: 'Crown',
  L: 'Laveen'
}

const lufSector = {
  N: 'North',
  S: 'South',
  SN: 'Snakeye'
}

const abqSector = {
  N: 'North',
  S: 'South',
  F: 'Finals'
}

const amaSector = {
  A: 'Feeder',
  F: 'Finals'
}

const rowSector = {
  E: 'East',
  W: 'West'
}