/*\

title: $:/plugins/felixhayashi/tiddlymap/edgetype.js
type: application/javascript
module-type: library

@module TiddlyMap
@preserve

\*/

(/** @lends module:TiddlyMap*/function() {

  /**************************** IMPORTS ****************************/

  // -
    
  /***************************** CODE ******************************/

  /**
   * This class is used to abstract edge types. It facilitates inter
   * alia the parsing of style information, the translation of type
   * names into actual type data or the persistance of edge type data.
   * 
   * @constructor
   * 
   * @param {string|EdgeType} type - Either the edge type id (name)
   *     or a tiddler reference denoting the type or an
   *     `EdgeType` object (that is directly bounced back). If the
   *     id can be translated into a tiddler object that resides in
   *     the edge type path, then its data is retrieved automatically.
   */
  var EdgeType = function(type) {

    if(type instanceof EdgeType) {
      return type; // bounce back the object
    }
    
    if(!type) {
      type = "tmap:unknown";
    } else if(typeof type !== "string") {
      throw "Cannot create edge-type"; 
    } 
    
    this.createShortcuts();
    this.data = this.utils.getDataMap();
    
    // which data fields are accepted to be set
    this.whitelist = [ "description", "style", "label",
                       "modified", "created", "show-label" ];
              
    this.id = this.utils.getWithoutPrefix(type, this.opt.path.edgeTypes + "/");
    this.loadDataFromType(this.id);

  };
  
  /**
   * Create shortcuts and aliases
   */
  EdgeType.prototype.createShortcuts = function() {
    
    this.wiki = $tw.wiki;
    this.opt = $tw.tmap.opt;
    this.logger = $tw.tmap.logger;
    this.utils = $tw.tmap.utils;
    
  };

  /**
   * @return {string}
   */
  EdgeType.prototype.getPath = function() {
  
    return (this.opt.path.edgeTypes + "/" + this.id);
  
  };
  
  /**
   * Method to determine whether or not this edge type exists. A type
   * exists if a tiddler with the type's id can be found under the
   * systems edge-type path.
   * 
   * @return {boolean} True if the edge type exists, false otherwise.
   */
  EdgeType.prototype.exists = function() {
  
    return this.utils.tiddlerExists(this.getPath());
  
  };
  
  EdgeType.prototype.getLabel = function() {
  
    return this.data.label || this.id.substring(this.id.indexOf(":") + 1);
  
  };
  
  EdgeType.prototype.getId = function() {

    return this.id;
  
  };
  
  EdgeType.prototype.getData = function(prop) {
    
    if(prop === "label") {
      return this.getLabel();
    }
    
    return (prop ? this.data[prop] : this.data);  
    
  };
  
  /**
   * If two arguments are provided, a key-value schema is assumed,
   * otherwise, the whole data object is replaced.
   */
  EdgeType.prototype.setData = function() {
    
    var args = arguments;
    
    if(args.length === 2) {
      if(typeof args[0] === "string") {
        if(args[0] === "style") {
          this.setStyle(args[1]);
        } else {
          if(args[1] && this.utils.inArray(args[0], this.whitelist)) {
            this.data[args[0]] = args[1];
          } else {
            delete this.data[args[0]];
          }
        }
      }
    } else if(args.length === 1 && typeof args[0] === "object") {
      for(var p in args[0]) {
        this.setData(p, args[0][p]);
      }
    }
   
  };
  
  EdgeType.prototype.setStyle = function(style, isMerge) {

    // preprocessing: try to turn string into json
    if(typeof style === "string") {
      style = this.utils.parseJSON(style);
    }
    
    // merge or override
    if(typeof style === "object") {
      if(isMerge) {
        this.utils.merge(this.data.style, style);
      } else {
        this.data.style = style;
      }
    }
      
  };
    
  /**
   * Store the edge-type object as tiddler in the wiki. If the `title`
   * property is not provided, the default edge-type path prefix 
   * will be used with the edge-type id appended. The style data is
   * written as JSON into the text field.
   * 
   * @param {string} [tRef] - If `tRef` is provided, the edge-type
   *     data will be written into this tiddler and the id property
   *     is added as extra field value. Do not use this option if you
   *     want the system to recognize the edge type. This is only for
   *     dumping purposes.
   * @param {boolean} [isPrettifyJSON] - True, if any json data should
   *     be stored in a prettified way, false otherwise.
   */
  EdgeType.prototype.persist = function(tRef, isPrettifyJSON) {

    if(!tRef) { tRef = this.getPath(); }
    
    if(typeof tRef === "string") {
    
      var fields = {
        title: tRef,
      };
      
      if(!this.utils.startsWith(tRef, this.opt.path.edgeTypes)) {
        fields.id = this.id;
      } else {
        $tw.utils.extend(fields, this.wiki.getModificationFields());
        if(!this.exists()) {
          $tw.utils.extend(fields, this.wiki.getCreationFields());
        }
      }
      

      var spaces = (isPrettifyJSON ? $tw.config.preferences.jsonSpaces : null);
      this.data.style = JSON.stringify(this.data.style, null, spaces);

      
      $tw.wiki.addTiddler(new $tw.Tiddler(this.data, fields));
      
    }
    
  };
  
  EdgeType.prototype.isAutoGenerated = function() {
    return (this.id === "tmap:link");
  };

  /**
   * Clone all data from the edgeType provided (except the id).
   * 
   * @param {*} edgeType - The edge-type containing the data.
   *     The  `edgeType` parameter may be a string denoting the
   *     type's id, a path (tiddler title), a `$tw.Tiddler` object
   *     or an `EdgeType` object.
   */
  EdgeType.prototype.loadDataFromType = function(type) {

    if(type instanceof EdgeType) {
      
      this.setData(type.getData());
      
    } else {
      
      if(type instanceof $tw.Tiddler) {
        // get only title; we need to check if the prefix is correct 
        type = type.fields.title;
      }
    
      if(typeof type === "string") {
        
        if(!this.utils.startsWith(type, this.opt.path.edgeTypes)) {
          type = this.opt.path.edgeTypes + "/" + type;
        }
        
        this.loadDataFromTiddler(this.wiki.getTiddler(type), false);
      }
    }
    
  };
  
  /**
   * Retrieve all data from the tiddler provided. If a shadow tiddler
   * with the same id exists, its data is merged during the load process.
   * 
   * @param {*} edgeType - The edge-type containing the data.
   *     The  `edgeType` parameter may be a string denoting the
   *     type's id, a path (tiddler title), a `$tw.Tiddler` object
   *     or an `EdgeType` object.
   * @param {boolean} [isAllowOverideId=false] - If the provided tiddler has
   *     an id field set, setting `isAllowOverideId` to `true` will cause
   *     the currently held id to be overridden.
   */
  EdgeType.prototype.loadDataFromTiddler = function(tiddler) {
    
    var tObj = this.utils.getTiddler(tiddler);
    if(tObj) {
      
      var shadowTObj = $tw.wiki.getSubTiddler(this.opt.path.pluginRoot,
                                              this.getPath());
      if(!shadowTObj) {
        shadowTObj = {};
      }
      
      var data = $tw.utils.extend({}, shadowTObj.fields, tObj.fields);
      
      this.setData(data);
      
    }
      
  };
  
  // !! EXPORT !!
  exports.EdgeType = EdgeType;
  // !! EXPORT !!#
  
})();