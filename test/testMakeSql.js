"use strict";

var assert = require("assert");
var makeSql = require("../makeSql");
var config = require("../config.json");

describe('testSqlForMapFeatures', function() {

    var filterString = '{"tree.id":{"IS":"1"}}';

    function assertSqlContains(options) {
        assert.ok(testSql(options).indexOf(options.expected) > -1);
    }

    function assertSqlLacks(options) {
        assert.ok(testSql(options).indexOf(options.expected) === -1);
    }

    function assertSqlEqual(options) {
        assert.equal(testSql(options), options.expected);
    }

    function testSql(options) {
        var zoom = options.zoom || 11,
            sql = makeSql.makeSqlForMapFeatures(
                options.filter,
                options.displayFilter,
                options.instanceId,
                zoom,
                options.isUtfGridRequest,
                options.isPolygonRequest);
        return sql;
    }

    // Fields

    it('has base fields for plain request', function() {
        assertSqlContains({
            expected: config.sqlForMapFeatures.fields.base
        });
    });

    it('has correct column for polygon request', function() {
        assertSqlContains({
            isPolygonRequest: true,
            expected: config.sqlForMapFeatures.fields.geom.polygon
        });
    });

    it('has extra fields for UTF grid request', function() {
        assertSqlContains({
            isUtfGridRequest: true,
            expected: config.sqlForMapFeatures.fields.utfGrid
        });
    });

    // Tables

    it('has base tables for plain request', function() {
        assertSqlContains({
            expected: config.sqlForMapFeatures.tables.mapFeature.sql
        });
    });

    it('has base polygon table for polygon request', function() {
        assertSqlContains({
            isPolygonRequest: true,
            expected: config.sqlForMapFeatures.tables.polygonalMapFeature.sql
        });
    });

    it('has mapFeatures tables for UTF grid without filter', function() {
        assertSqlContains({
            isUtfGridRequest: true,
            expected: config.sqlForMapFeatures.tables.mapFeature.sql
        });
    });

    // WHERE

    it('has no WHERE clause for plain request', function() {
        assertSqlLacks({
            expected: 'WHERE'
        });
    });

    it('has WHERE clause when filter string passed', function() {
        assertSqlContains({
            filter: filterString,
            expected: ' WHERE '
        });
    });

    it('has WHERE clause when tree display filter passed', function() {
        assertSqlContains({
            displayFilter: '["Tree"]',
            expected: ' WHERE '
        });
    });

    it('has WHERE clause when plot display filter passed', function() {
        assertSqlContains({
            displayFilter: '["Plot"]',
            expected: ' WHERE '
        });
    });

    it('lacks WHERE clause when no display filter passed', function() {
        assertSqlLacks({
            expected: ' WHERE '
        });
    });

    it('has instance ID when one is passed', function() {
        assertSqlContains({
            instanceId: 2345,
            expected: '2345'
        });
    });

    it('has AND when both instance ID and filter passed', function() {
        assertSqlContains({
            filter: filterString,
            instanceId: 2345,
            expected: ' AND '
        });
    });


    it('disregards non-tree models when a simple tree filter is active', function() {
        assertSqlEqual({
            isPolygonRequest: true,
            displayFilter: '["Tree", "FireHydrant"]',
            filter: '{"tree.diameter":{"MIN":1,"MAX":100}}',
            expected: '( SELECT DISTINCT(stormwater_polygonalmapfeature.polygon) AS the_geom_webmercator, ' +
                'feature_type FROM treemap_mapfeature LEFT OUTER JOIN treemap_tree ON ' +
                'treemap_mapfeature.id = treemap_tree.plot_id ' +
                'LEFT OUTER JOIN stormwater_polygonalmapfeature ' +
                'ON stormwater_polygonalmapfeature.mapfeature_ptr_id = treemap_mapfeature.id ' +
                'WHERE ( (("treemap_tree"."id" IS NOT NULL) AND ("treemap_mapfeature"."feature_type" = \'Plot\')) ) ' +
                'AND ("treemap_tree"."diameter" >= 1 ' +
                'AND "treemap_tree"."diameter" <= 100) ' +
                ') otmfiltersql '
        });
    });

    it('disregards non-tree models when a complex tree filter is active', function() {
        assertSqlEqual({
            isPolygonRequest: true,
            displayFilter: '["Tree", "FireHydrant"]',
            filter: '["AND",{"tree.diameter":{"MIN":1,"MAX":100}},["OR",{"udf:tree:198.Status":{"IS":"Unresolved"}}]]',
            expected: '( SELECT DISTINCT(stormwater_polygonalmapfeature.polygon) AS the_geom_webmercator, ' +
                'feature_type FROM treemap_mapfeature LEFT OUTER JOIN treemap_tree ON ' +
                'treemap_mapfeature.id = treemap_tree.plot_id CROSS JOIN treemap_userdefinedcollectionvalue  ' +
                'LEFT OUTER JOIN stormwater_polygonalmapfeature ' +
                'ON stormwater_polygonalmapfeature.mapfeature_ptr_id = treemap_mapfeature.id ' +
                'WHERE ( (("treemap_tree"."id" IS NOT NULL) AND ("treemap_mapfeature"."feature_type" = \'Plot\')) ) ' +
                'AND (("treemap_tree"."diameter" >= 1 ' +
                'AND "treemap_tree"."diameter" <= 100) ' +
                'AND (("treemap_userdefinedcollectionvalue"."data"->\'Status\' = \'Unresolved\' ' +
                'AND treemap_userdefinedcollectionvalue.field_definition_id=198 ' +
                'AND treemap_userdefinedcollectionvalue.model_id=treemap_tree.id))) ) otmfiltersql '
        });
    });
});
